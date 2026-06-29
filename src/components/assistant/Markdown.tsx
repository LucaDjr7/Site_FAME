'use client'
import React from 'react'

// Renderer Markdown minimal et tolérant au streaming. Gère : gras, italique, code inline,
// liens, listes (- / 1.), paragraphes. Un marqueur non fermé reste littéral (pas de crash).

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Ordre : liens, gras, code, italique. Regex globale unique par passe simple.
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*|_([^_]+)_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const key = `${keyPrefix}-${i++}`
    if (m[1]) {
      nodes.push(<a key={key} href={m[3]} target="_blank" rel="noopener noreferrer" style={{ color: '#2f4486', textDecoration: 'underline' }}>{m[2]}</a>)
    } else if (m[4]) {
      nodes.push(<strong key={key}>{m[5]}</strong>)
    } else if (m[6]) {
      nodes.push(<code key={key} style={{ fontFamily: 'var(--font-ibm-plex-mono, monospace)', background: 'rgba(20,40,90,0.06)', borderRadius: 3, padding: '0 3px' }}>{m[7]}</code>)
    } else if (m[8]) {
      nodes.push(<em key={key}>{m[9] ?? m[10]}</em>)
    }
    last = pattern.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').split('\n')
  const blocks: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []

  const flushPara = (k: string) => { if (para.length) { blocks.push(<p key={k} style={{ margin: '0 0 6px' }}>{renderInline(para.join(' '), k)}</p>); para = [] } }
  const flushList = (k: string) => {
    if (!list) return
    const items = list.items.map((it, j) => <li key={`${k}-li-${j}`}>{renderInline(it, `${k}-li-${j}`)}</li>)
    blocks.push(list.ordered ? <ol key={k} style={{ margin: '0 0 6px', paddingLeft: 18 }}>{items}</ol> : <ul key={k} style={{ margin: '0 0 6px', paddingLeft: 18 }}>{items}</ul>)
    list = null
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (bullet) { flushPara(`p-${idx}`); if (!list || list.ordered) { flushList(`l-${idx}`); list = { ordered: false, items: [] } } list.items.push(bullet[1] ?? ''); return }
    if (ordered) { flushPara(`p-${idx}`); if (!list || !list.ordered) { flushList(`l-${idx}`); list = { ordered: true, items: [] } } list.items.push(ordered[1] ?? ''); return }
    if (line.trim() === '') { flushPara(`p-${idx}`); flushList(`l-${idx}`); return }
    flushList(`l-${idx}`)
    para.push(line)
  })
  flushPara('p-end'); flushList('l-end')
  return <>{blocks}</>
}
