'use client'
import { useCallback, useState } from 'react'
import type { ChatUiMessage, AssistantStatus, SourceRef } from './types'

// Pure parser — sépare les événements SSE complets du reste incomplet.
export function parseSseChunk(buffer: string): { events: { event: string; data: unknown }[]; rest: string } {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: { event: string; data: unknown }[] = []
  for (const block of parts) {
    let event = 'message'
    let dataLine = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLine += line.slice(5).trim()
    }
    if (!dataLine) continue
    try { events.push({ event, data: JSON.parse(dataLine) }) } catch { /* ignore */ }
  }
  return { events, rest }
}

export function useAssistantChat(opts: { endpoint?: string; fetchImpl?: typeof fetch } = {}) {
  const endpoint = opts.endpoint ?? '/api/assistant/chat'
  const doFetch = opts.fetchImpl ?? fetch
  const [messages, setMessages] = useState<ChatUiMessage[]>([])
  const [status, setStatus] = useState<AssistantStatus>('idle')

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const history: ChatUiMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStatus('streaming')

    const removeEmptyPlaceholder = () =>
      setMessages(prev =>
        prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && m.content === '')),
      )

    let res: Response
    try {
      res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
      })
    } catch { removeEmptyPlaceholder(); setStatus('error'); return }

    if (res.status === 503) { removeEmptyPlaceholder(); setStatus('degraded'); return }
    if (res.status === 429) { removeEmptyPlaceholder(); setStatus('rate_limited'); return }
    if (!res.ok || !res.body) { removeEmptyPlaceholder(); setStatus('error'); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const apply = (updater: (m: ChatUiMessage) => ChatUiMessage) =>
      setMessages(prev => prev.map((m, i) => (i === prev.length - 1 ? updater(m) : m)))

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSseChunk(buffer)
      buffer = rest
      for (const { event, data } of events) {
        if (event === 'sources') apply(m => ({ ...m, sources: data as SourceRef[] }))
        else if (event === 'unanswered') { const d = data as { text: string; proposeQuestion: string }; apply(m => ({ ...m, content: d.text, unanswered: true, proposeQuestion: d.proposeQuestion })) }
        else if (event === 'refusal') { const d = data as { text: string }; apply(m => ({ ...m, content: d.text })) }
        else if (event === 'error') setStatus('error')
        else if (event === 'message') { const d = data as { delta?: string }; if (d.delta) apply(m => ({ ...m, content: m.content + d.delta })) }
      }
    }
    setStatus(s => (s === 'streaming' ? 'idle' : s))
  }, [messages, endpoint, doFetch])

  const reset = useCallback(() => { setMessages([]); setStatus('idle') }, [])
  return { messages, status, send, reset }
}
