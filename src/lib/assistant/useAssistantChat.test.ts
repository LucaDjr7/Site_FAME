// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { parseSseChunk, useAssistantChat } from './useAssistantChat'

describe('parseSseChunk', () => {
  it('parse plusieurs événements et garde le reste incomplet', () => {
    const raw = 'event: sources\ndata: [{"source_type":"subject","source_id":"s1","labo":"paris"}]\n\ndata: {"delta":"Hel"}\n\ndata: {"delta":"lo"}'
    const { events, rest } = parseSseChunk(raw)
    expect(events).toEqual([
      { event: 'sources', data: [{ source_type: 'subject', source_id: 's1', labo: 'paris' }] },
      { event: 'message', data: { delta: 'Hel' } },
    ])
    expect(rest).toBe('data: {"delta":"lo"}')
  })
  it('événement done', () => {
    const { events } = parseSseChunk('event: done\ndata: {}\n\n')
    expect(events[0]).toEqual({ event: 'done', data: {} })
  })
})

describe('useAssistantChat hook', () => {
  it('429 → status rate_limited', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 429 }))
    const { result } = renderHook(() => useAssistantChat({ fetchImpl: mockFetch as typeof fetch }))
    await act(async () => {
      await result.current.send('hello')
    })
    expect(result.current.status).toBe('rate_limited')
  })

  it('503 → no residual empty assistant message', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    const { result } = renderHook(() => useAssistantChat({ fetchImpl: mockFetch as typeof fetch }))
    await act(async () => {
      await result.current.send('hello')
    })
    expect(result.current.status).toBe('degraded')
    const emptyAssistantMsgs = result.current.messages.filter(
      m => m.role === 'assistant' && m.content === '',
    )
    expect(emptyAssistantMsgs).toHaveLength(0)
  })

  it('SSE event:error → status error sans bulle assistant vide résiduelle (M1)', async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('event: error\ndata: {}\n\n'))
        c.close()
      },
    })
    const mockFetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }))
    const { result } = renderHook(() => useAssistantChat({ fetchImpl: mockFetch as typeof fetch }))
    await act(async () => { await result.current.send('hello') })
    expect(result.current.status).toBe('error')
    expect(result.current.messages.filter(m => m.role === 'assistant' && m.content === '')).toHaveLength(0)
  })

  it('coupure réseau en cours de stream → status error, pas bloqué en streaming (I6)', async () => {
    const stream = new ReadableStream({ start(c) { c.error(new Error('network drop')) } })
    const mockFetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }))
    const { result } = renderHook(() => useAssistantChat({ fetchImpl: mockFetch as typeof fetch }))
    await act(async () => { await result.current.send('hello') })
    expect(result.current.status).toBe('error')
    expect(result.current.messages.filter(m => m.role === 'assistant' && m.content === '')).toHaveLength(0)
  })
})
