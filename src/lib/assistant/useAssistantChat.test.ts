import { describe, it, expect } from 'vitest'
import { parseSseChunk } from './useAssistantChat'

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
