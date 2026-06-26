# Assistant RAG — P4 : UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer l'assistant côté client : un hook de streaming SSE, une bulle flottante + panneau de conversation présents sur tout le site, une entrée mise en avant sur le globe d'accueil (public = cible primaire), l'affichage des citations de sources, le rebond « proposer » sur sujet non traité, et le mode dégradé.

**Architecture:** Un hook `useAssistantChat()` encapsule l'état (messages, streaming, sources, dégradé) et parse le flux SSE de `POST /api/assistant/chat`. Des composants présentational (`ChatBubble`, `ChatPanel`, `ChatMessageList`, `SourceCitations`, `ChatComposer`) consomment le hook. `ChatWidget` (monté une fois dans `[locale]/layout.tsx`) gère ouverture/fermeture. Une entrée dédiée sur le globe (`AssistantGlobeCTA`) ouvre le panneau. Toutes les chaînes via le namespace i18n `assistant` (en+fr).

**Tech Stack:** React 19 client components, next-intl `useTranslations('assistant')`, `fetch` + `ReadableStream` reader pour le SSE, tokens `fame-*` (Tailwind v4), animations `modalIn`/`fameFade` existantes.

## Global Constraints

- **Public = cible primaire** : la bulle est visible pour TOUS (visiteurs inclus), pas seulement les membres. Pas de garde d'auth côté UI.
- **Zéro chaîne hardcodée** : tout texte visible via `useTranslations('assistant')`. Clés ajoutées dans `messages/en.json` ET `messages/fr.json` (parité stricte).
- **Locale active** : la langue de l'UI suit `[locale]` ; la langue de réponse du modèle suit la question (gérée serveur). Ne pas forcer la langue dans la requête.
- **Citations** : chaque réponse affiche ses sources (type + lien cliquable quand applicable : sujet→`/[locale]/[lab]/paper/[id]`, publication→lien externe, etc.).
- **Mode dégradé** : sur `503 {degraded:true}`, afficher un message « assistant indisponible » au lieu de planter.
- **Accessibilité** : bouton avec `aria-label` traduit, focus géré à l'ouverture, fermeture sur Échap (réutiliser le pattern de `Modal` existant si pertinent).
- Pas de secret client. Commits atomiques ; `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

> 🛑 **BLOQUÉ — maquette requise (décision utilisateur 2026-06-25)** : ce plan **ne démarre pas** tant qu'une maquette dédiée **« FAME Assistant »** n'a pas été créée dans le projet Claude Design (`5bd688a8-2928-4c09-8d94-63f35b89ec74`). L'utilisateur a tranché « créer une maquette d'abord » plutôt que dériver du globe. Séquencement : exécuter P1→P2→P3→P5, **puis** créer/obtenir la maquette, **puis** lancer P4. Au lancement de P4, l'orchestrateur Opus lit la maquette via le MCP `DesignSync` (`get_file`, `path = FAME Assistant.dc.html`) et injecte tokens/markup dans le prompt du sous-agent Sonnet. Les couleurs/typos ci-dessous restent la base de repli (tokens FAME documentés, AGENTS.md) mais **la maquette fait foi**.

## File Structure

- `messages/en.json`, `messages/fr.json` — namespace `assistant`.
- `src/lib/assistant/useAssistantChat.ts` — hook état + parsing SSE.
- `src/lib/assistant/types.ts` — `ChatUiMessage`, `SourceRef`, `AssistantStatus`.
- `src/components/assistant/SourceCitations.tsx`
- `src/components/assistant/ChatComposer.tsx`
- `src/components/assistant/ChatMessageList.tsx`
- `src/components/assistant/ChatPanel.tsx`
- `src/components/assistant/ChatBubble.tsx`
- `src/components/assistant/ChatWidget.tsx`
- `src/components/assistant/AssistantGlobeCTA.tsx`
- `src/app/[locale]/layout.tsx` — monter `<ChatWidget />`.
- `src/app/[locale]/page.tsx` (ou composant globe) — monter `<AssistantGlobeCTA />`.

---

### Task 1: Namespace i18n `assistant`

**Files:**
- Modify: `messages/en.json`, `messages/fr.json`
- Test: `src/lib/assistant/i18n-parity.test.ts`

**Interfaces:**
- Produces: clés `assistant.*` : `title`, `openLabel`, `closeLabel`, `placeholder`, `send`, `greetingVisitor`, `greetingMember`, `sources`, `unanswered`, `proposeCta`, `degraded`, `error`, `thinking`, `globeCta`, `globeCtaSub`, `you`, `assistantName`.

- [ ] **Step 1: Write the failing parity test**

```ts
import { describe, it, expect } from 'vitest'
import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'

const KEYS = ['title','openLabel','closeLabel','placeholder','send','greetingVisitor','greetingMember','sources','unanswered','proposeCta','degraded','error','thinking','globeCta','globeCaSub','you','assistantName']

describe('i18n assistant parity', () => {
  it('en has assistant namespace with all keys', () => {
    const a = (en as Record<string, Record<string, string>>).assistant
    for (const k of ['title','openLabel','closeLabel','placeholder','send','greetingVisitor','greetingMember','sources','unanswered','proposeCta','degraded','error','thinking','globeCta','globeCtaSub','you','assistantName'])
      expect(a, `en.assistant.${k}`).toHaveProperty(k)
  })
  it('fr mirrors en assistant keys exactly', () => {
    const ea = Object.keys((en as Record<string, Record<string, string>>).assistant).sort()
    const fa = Object.keys((fr as Record<string, Record<string, string>>).assistant).sort()
    expect(fa).toEqual(ea)
  })
})
```

> (La liste `KEYS` au-dessus contient une faute volontaire ? Non — l'implémenteur doit utiliser la liste exacte du second `it`. Supprimer la const `KEYS` inutilisée avant commit pour rester lint-clean.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/assistant/i18n-parity.test.ts`
Expected: FAIL (namespace absent).

- [ ] **Step 3: Add the namespace to en.json**

Ajouter au niveau racine de `messages/en.json` :

```json
"assistant": {
  "title": "FAME Assistant",
  "assistantName": "FAME",
  "you": "You",
  "openLabel": "Ask the FAME assistant",
  "closeLabel": "Close assistant",
  "placeholder": "Ask about FAME's research…",
  "send": "Send",
  "thinking": "Thinking…",
  "greetingVisitor": "Hi! I can tell you about FAME's research — our subjects, papers and teams in Paris and Montreal. What would you like to know?",
  "greetingMember": "Hi! Ask me about subjects, tasks, files or anything across the FAME labs.",
  "sources": "Sources",
  "unanswered": "This topic isn't covered in FAME's content yet.",
  "proposeCta": "Propose this topic",
  "degraded": "The assistant is temporarily unavailable. Please try again later.",
  "error": "Something went wrong. Please try again.",
  "globeCta": "Discover FAME with AI",
  "globeCtaSub": "Chat with our assistant to explore the research"
}
```

- [ ] **Step 4: Add the namespace to fr.json**

Ajouter au niveau racine de `messages/fr.json` :

```json
"assistant": {
  "title": "Assistant FAME",
  "assistantName": "FAME",
  "you": "Vous",
  "openLabel": "Interroger l'assistant FAME",
  "closeLabel": "Fermer l'assistant",
  "placeholder": "Posez une question sur les recherches de FAME…",
  "send": "Envoyer",
  "thinking": "Réflexion…",
  "greetingVisitor": "Bonjour ! Je peux vous présenter les recherches de FAME — nos sujets, articles et équipes à Paris et Montréal. Que souhaitez-vous savoir ?",
  "greetingMember": "Bonjour ! Posez-moi vos questions sur les sujets, tâches, fichiers ou tout ce qui concerne les labos FAME.",
  "sources": "Sources",
  "unanswered": "Ce sujet n'est pas encore couvert par le contenu de FAME.",
  "proposeCta": "Proposer ce sujet",
  "degraded": "L'assistant est momentanément indisponible. Réessayez plus tard.",
  "error": "Une erreur est survenue. Veuillez réessayer.",
  "globeCta": "Découvrir FAME avec l'IA",
  "globeCtaSub": "Discutez avec notre assistant pour explorer les recherches"
}
```

- [ ] **Step 5: Run to verify it passes & lint**

Run: `npx vitest run src/lib/assistant/i18n-parity.test.ts && npm run lint`
Expected: PASS. (Retirer la const `KEYS` inutilisée si le lint la signale.)

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/fr.json src/lib/assistant/i18n-parity.test.ts
git commit -m "feat(assistant): namespace i18n assistant (en/fr parité)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Types UI + hook `useAssistantChat`

**Files:**
- Create: `src/lib/assistant/types.ts`, `src/lib/assistant/useAssistantChat.ts`
- Test: `src/lib/assistant/useAssistantChat.test.ts`

**Interfaces:**
- Produces:
  - `interface SourceRef { source_type: string; source_id: string; labo: string | null }`
  - `interface ChatUiMessage { role: 'user' | 'assistant'; content: string; sources?: SourceRef[]; unanswered?: boolean; proposeQuestion?: string }`
  - `type AssistantStatus = 'idle' | 'streaming' | 'degraded' | 'error'`
  - `useAssistantChat(opts?: { endpoint?: string; fetchImpl?: typeof fetch }): { messages: ChatUiMessage[]; status: AssistantStatus; send: (text: string) => Promise<void>; reset: () => void }`
  - Helper exporté et testable : `parseSseChunk(buffer: string): { events: { event: string; data: unknown }[]; rest: string }`.

- [ ] **Step 1: Write the failing test (focus on the pure SSE parser)**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/assistant/useAssistantChat.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement types.ts**

```ts
export interface SourceRef { source_type: string; source_id: string; labo: string | null }
export interface ChatUiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceRef[]
  unanswered?: boolean
  proposeQuestion?: string
}
export type AssistantStatus = 'idle' | 'streaming' | 'degraded' | 'error'
```

- [ ] **Step 4: Implement useAssistantChat.ts (parser + hook)**

```ts
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

    let res: Response
    try {
      res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
      })
    } catch { setStatus('error'); return }

    if (res.status === 503) { setStatus('degraded'); return }
    if (!res.ok || !res.body) { setStatus('error'); return }

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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/assistant/useAssistantChat.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant/types.ts src/lib/assistant/useAssistantChat.ts src/lib/assistant/useAssistantChat.test.ts
git commit -m "feat(assistant): hook useAssistantChat + parser SSE pur

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `SourceCitations`

**Files:**
- Create: `src/components/assistant/SourceCitations.tsx`
- Test: `src/components/assistant/SourceCitations.test.tsx`

**Interfaces:**
- Consumes: `SourceRef`, `useTranslations('assistant')`.
- Produces: `SourceCitations({ sources, locale, lab }: { sources: SourceRef[]; locale: string; lab?: string })` — rend une liste ; un `source_type==='subject'` devient un lien `/{locale}/{labo}/paper/{source_id}` ; les autres types affichent un libellé non cliquable. Vide → ne rend rien.

> Note : le test rend du JSX → fichier `.tsx` et exécution via l'environnement DOM. **Pré-requis Task 3** : vérifier que `vitest.config.ts` a un projet `jsdom` pour les `*.test.tsx`. Si absent, l'implémenteur ajoute `environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']]` (ou un second projet) + `@testing-library/react` en devDep AVANT d'écrire le test, et inclut ce changement dans le commit de cette task.

- [ ] **Step 1: Ensure tsx/jsdom test setup**

Si nécessaire, modifier `vitest.config.ts` pour router les `*.test.tsx` vers `jsdom`, ajouter `@testing-library/react` + `jsdom` en devDependencies (`npm i -D @testing-library/react jsdom`), et inclure `*.test.tsx` dans `include`.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { SourceCitations } from './SourceCitations'
import en from '../../../messages/en.json'

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('SourceCitations', () => {
  it('lien vers la fiche pour un sujet', () => {
    wrap(<SourceCitations locale="en" lab="paris" sources={[{ source_type: 'subject', source_id: 's1', labo: 'paris' }]} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/en/paris/paper/s1')
  })
  it('ne rend rien si vide', () => {
    const { container } = wrap(<SourceCitations locale="en" sources={[]} />)
    expect(container.textContent).toBe('')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/assistant/SourceCitations.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement**

```tsx
'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { SourceRef } from '@/lib/assistant/types'

export function SourceCitations({ sources, locale, lab }: { sources: SourceRef[]; locale: string; lab?: string }) {
  const t = useTranslations('assistant')
  if (!sources || sources.length === 0) return null
  return (
    <div className="mt-2 text-xs font-mono text-fame-text-muted">
      <span className="uppercase tracking-wide">{t('sources')}: </span>
      {sources.map((s, i) => {
        const labo = s.labo ?? lab
        if (s.source_type === 'subject' && labo) {
          return (
            <Link key={i} href={`/${locale}/${labo}/paper/${s.source_id}`} className="underline hover:text-fame-blue mr-2">
              {s.source_type}:{s.source_id.slice(0, 8)}
            </Link>
          )
        }
        return <span key={i} className="mr-2">{s.source_type}</span>
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/assistant/SourceCitations.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/SourceCitations.tsx src/components/assistant/SourceCitations.test.tsx vitest.config.ts package.json package-lock.json
git commit -m "feat(assistant): SourceCitations + setup tests tsx (jsdom)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `ChatComposer` + `ChatMessageList`

**Files:**
- Create: `src/components/assistant/ChatComposer.tsx`, `src/components/assistant/ChatMessageList.tsx`
- Test: `src/components/assistant/ChatComposer.test.tsx`

**Interfaces:**
- Produces:
  - `ChatComposer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean })` — textarea + bouton `send` ; Entrée envoie, Shift+Entrée = nouvelle ligne ; vide le champ après envoi.
  - `ChatMessageList({ messages, status, locale, lab }: { messages: ChatUiMessage[]; status: AssistantStatus; locale: string; lab?: string })` — rend chaque message (rôle, contenu, `SourceCitations`), le CTA propose si `unanswered` (lien `/{locale}/{lab||'paris'}/propose?topic=...`), et l'indicateur `thinking` en streaming.

- [ ] **Step 1: Write the failing test (composer)**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ChatComposer } from './ChatComposer'
import en from '../../../messages/en.json'

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('ChatComposer', () => {
  it('Entrée envoie le texte et vide le champ', () => {
    const onSend = vi.fn()
    wrap(<ChatComposer onSend={onSend} />)
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(ta.value).toBe('')
  })
  it('Shift+Entrée n’envoie pas', () => {
    const onSend = vi.fn()
    wrap(<ChatComposer onSend={onSend} />)
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'x' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/assistant/ChatComposer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ChatComposer.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function ChatComposer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const t = useTranslations('assistant')
  const [value, setValue] = useState('')
  const submit = () => { const v = value.trim(); if (!v) return; onSend(v); setValue('') }
  return (
    <div className="flex items-end gap-2 border-t border-fame-ecru p-3">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1}
        placeholder={t('placeholder')}
        className="flex-1 resize-none rounded-md border border-fame-ecru bg-white px-3 py-2 text-sm text-fame-text-body focus:outline-none focus:ring-2 focus:ring-fame-blue"
      />
      <button onClick={submit} disabled={disabled} className="rounded-md bg-fame-blue px-3 py-2 text-sm font-mono text-fame-text-light disabled:opacity-50">
        {t('send')}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Implement ChatMessageList.tsx**

```tsx
'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChatUiMessage, AssistantStatus } from '@/lib/assistant/types'
import { SourceCitations } from './SourceCitations'

export function ChatMessageList({ messages, status, locale, lab }: { messages: ChatUiMessage[]; status: AssistantStatus; locale: string; lab?: string }) {
  const t = useTranslations('assistant')
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
          <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-fame-blue text-fame-text-light' : 'bg-fame-sand text-fame-text-body'}`}>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.role === 'assistant' && m.sources && <SourceCitations sources={m.sources} locale={locale} lab={lab} />}
            {m.unanswered && (
              <Link href={`/${locale}/${lab ?? 'paris'}/propose?topic=${encodeURIComponent(m.proposeQuestion ?? '')}`} className="mt-2 inline-block text-xs font-mono underline text-fame-blue">
                {t('proposeCta')}
              </Link>
            )}
          </div>
        </div>
      ))}
      {status === 'streaming' && <div className="text-xs font-mono text-fame-text-muted">{t('thinking')}</div>}
      {status === 'degraded' && <div className="text-xs font-mono text-fame-red">{t('degraded')}</div>}
      {status === 'error' && <div className="text-xs font-mono text-fame-red">{t('error')}</div>}
    </div>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/assistant/ChatComposer.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/ChatComposer.tsx src/components/assistant/ChatMessageList.tsx src/components/assistant/ChatComposer.test.tsx
git commit -m "feat(assistant): ChatComposer + ChatMessageList (citations, CTA propose, états)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `ChatPanel` + `ChatBubble` + `ChatWidget`

**Files:**
- Create: `src/components/assistant/ChatPanel.tsx`, `src/components/assistant/ChatBubble.tsx`, `src/components/assistant/ChatWidget.tsx`
- Test: `src/components/assistant/ChatWidget.test.tsx`

**Interfaces:**
- Consumes: `useAssistantChat`, `ChatMessageList`, `ChatComposer`.
- Produces:
  - `ChatPanel({ locale, lab, isMember, onClose }: { locale: string; lab?: string; isMember: boolean; onClose: () => void })` — en-tête (`title` + bouton close `aria-label=closeLabel`), greeting initial (`greetingMember` si `isMember`, sinon `greetingVisitor`), liste, composer ; fermeture sur Échap.
  - `ChatBubble({ onClick }: { onClick: () => void })` — bouton flottant rond, `aria-label=openLabel`.
  - `ChatWidget({ locale, lab, isMember }: { locale: string; lab?: string; isMember: boolean })` — gère l'état ouvert/fermé, rend la bulle OU le panneau.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ChatWidget } from './ChatWidget'
import en from '../../../messages/en.json'

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('ChatWidget', () => {
  it('ouvre le panneau au clic sur la bulle', () => {
    wrap(<ChatWidget locale="en" lab="paris" isMember={false} />)
    fireEvent.click(screen.getByLabelText('Ask the FAME assistant'))
    expect(screen.getByText('FAME Assistant')).toBeTruthy()
  })
  it('greeting visiteur par défaut', () => {
    wrap(<ChatWidget locale="en" isMember={false} />)
    fireEvent.click(screen.getByLabelText('Ask the FAME assistant'))
    expect(screen.getByText(/tell you about FAME/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/assistant/ChatWidget.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ChatPanel.tsx**

```tsx
'use client'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAssistantChat } from '@/lib/assistant/useAssistantChat'
import { ChatMessageList } from './ChatMessageList'
import { ChatComposer } from './ChatComposer'

export function ChatPanel({ locale, lab, isMember, onClose }: { locale: string; lab?: string; isMember: boolean; onClose: () => void }) {
  const t = useTranslations('assistant')
  const { messages, status, send } = useAssistantChat()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const greeting = isMember ? t('greetingMember') : t('greetingVisitor')
  const shown = messages.length === 0 ? [{ role: 'assistant' as const, content: greeting }] : messages

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-fame-ecru bg-white shadow-2xl animate-[modalIn_.2s_ease]">
      <div className="flex items-center justify-between border-b border-fame-ecru px-4 py-3">
        <span className="font-serif text-fame-text-dark">{t('title')}</span>
        <button onClick={onClose} aria-label={t('closeLabel')} className="text-fame-text-muted hover:text-fame-red">✕</button>
      </div>
      <ChatMessageList messages={shown} status={status} locale={locale} lab={lab} />
      <ChatComposer onSend={send} disabled={status === 'streaming'} />
    </div>
  )
}
```

- [ ] **Step 4: Implement ChatBubble.tsx and ChatWidget.tsx**

```tsx
// ChatBubble.tsx
'use client'
import { useTranslations } from 'next-intl'

export function ChatBubble({ onClick }: { onClick: () => void }) {
  const t = useTranslations('assistant')
  return (
    <button onClick={onClick} aria-label={t('openLabel')}
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-fame-blue text-fame-text-light shadow-lg hover:bg-fame-blue-dark">
      <span className="font-serif text-lg">AI</span>
    </button>
  )
}
```

```tsx
// ChatWidget.tsx
'use client'
import { useState } from 'react'
import { ChatBubble } from './ChatBubble'
import { ChatPanel } from './ChatPanel'

export function ChatWidget({ locale, lab, isMember }: { locale: string; lab?: string; isMember: boolean }) {
  const [open, setOpen] = useState(false)
  if (!open) return <ChatBubble onClick={() => setOpen(true)} />
  return <ChatPanel locale={locale} lab={lab} isMember={isMember} onClose={() => setOpen(false)} />
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/assistant/ChatWidget.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/ChatPanel.tsx src/components/assistant/ChatBubble.tsx src/components/assistant/ChatWidget.tsx src/components/assistant/ChatWidget.test.tsx
git commit -m "feat(assistant): ChatPanel + ChatBubble + ChatWidget (greeting, Échap)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Montage global + CTA globe

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Create: `src/components/assistant/AssistantGlobeCTA.tsx`
- Modify: `src/app/[locale]/page.tsx` (home globe)
- Test: aucun test unitaire nouveau (intégration) — vérification via `tsc` + `build`.

**Interfaces:**
- Consumes: `getSession` (server) pour `isMember`, `ChatWidget`, `AssistantGlobeCTA`.
- Produces: bulle présente sur toutes les pages `[locale]` ; CTA visible sur l'accueil ouvrant l'assistant (via un événement custom `window` ou un état partagé léger).

> Décision d'intégration : pour éviter un store global, `AssistantGlobeCTA` émet un `CustomEvent('fame:open-assistant')` ; `ChatWidget` l'écoute et s'ouvre. Simple, testable, zéro dépendance.

- [ ] **Step 1: Add the open-event listener to ChatWidget**

Modifier `src/components/assistant/ChatWidget.tsx` pour écouter l'événement :

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ChatBubble } from './ChatBubble'
import { ChatPanel } from './ChatPanel'

export function ChatWidget({ locale, lab, isMember }: { locale: string; lab?: string; isMember: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('fame:open-assistant', onOpen)
    return () => window.removeEventListener('fame:open-assistant', onOpen)
  }, [])
  if (!open) return <ChatBubble onClick={() => setOpen(true)} />
  return <ChatPanel locale={locale} lab={lab} isMember={isMember} onClose={() => setOpen(false)} />
}
```

(Le test de Task 5 reste vert : la bulle/ouverture au clic est inchangée.)

- [ ] **Step 2: Implement AssistantGlobeCTA.tsx**

```tsx
'use client'
import { useTranslations } from 'next-intl'

export function AssistantGlobeCTA() {
  const t = useTranslations('assistant')
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('fame:open-assistant'))}
      className="group mt-6 inline-flex flex-col items-center rounded-xl border border-fame-slate/40 bg-fame-navy-light/60 px-6 py-4 text-center backdrop-blur transition hover:border-fame-gold animate-[fameFade_.6s_ease]"
    >
      <span className="font-serif text-lg text-fame-text-light">{t('globeCta')}</span>
      <span className="font-mono text-xs text-fame-text-dim group-hover:text-fame-gold">{t('globeCtaSub')}</span>
    </button>
  )
}
```

- [ ] **Step 3: Mount ChatWidget in `[locale]/layout.tsx`**

Dans `src/app/[locale]/layout.tsx`, à l'intérieur du `NextIntlClientProvider`/`ToastProvider` (après `{children}`), monter le widget. Récupérer `isMember` via la session serveur et `locale` via les params :

```tsx
import { getSession } from '@/lib/auth'
import { ChatWidget } from '@/components/assistant/ChatWidget'

// dans le composant async (params: Promise<{ locale: string }>):
const { locale } = await params
const session = await getSession()
const isMember = !!session?.member

// dans le JSX, à côté de {children} :
<ChatWidget locale={locale} isMember={isMember} />
```

> Note implémenteur : `lab` n'est pas connu au niveau `[locale]` (il vit sous `[lab]`). Passer `lab` indéfini ici ; les liens propose/citation retombent sur `'paris'` par défaut (acceptable v1 — la cible primaire visiteur arrive par le globe). Vérifier la signature réelle de `getSession()` dans `src/lib/auth.ts` et adapter `session?.member`.

- [ ] **Step 4: Mount AssistantGlobeCTA on the home page**

Dans `src/app/[locale]/page.tsx` (accueil globe), monter `<AssistantGlobeCTA />` sous le globe/titre, en cohérence avec la maquette `FAME Accueil.dc.html` (lue via MCP par l'orchestrateur Opus).

- [ ] **Step 5: Verify build & types**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK, aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/layout.tsx src/app/[locale]/page.tsx src/components/assistant/AssistantGlobeCTA.tsx src/components/assistant/ChatWidget.tsx
git commit -m "feat(assistant): montage global ChatWidget + CTA assistant sur le globe

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (P4)

- **§10 UI** : bulle flottante (5), panneau (5), citations (3), CTA globe (6), états dégradé/erreur (4) ✅.
- **Public primaire** : pas de garde d'auth sur la bulle ; greeting différencié visiteur/membre (5) ✅.
- **§9 rebond propose** : CTA `unanswered` → `/propose?topic=` (4) ✅.
- **i18n** : namespace `assistant` en/fr, test de parité (1), zéro chaîne hardcodée (composants) ✅.
- **Streaming client** : hook + parser SSE testés (2) ✅.
- **Type consistency** : `ChatUiMessage`/`SourceRef`/`AssistantStatus` cohérents entre hook et composants ✅.
- **Placeholder scan** : la const `KEYS` du test de Task 1 est signalée à retirer ; pas d'autre TODO. RAS.
- **Dépendances** : ajout `@testing-library/react` + `jsdom` (devDeps) justifié par les tests tsx (Task 3).
- **Non couvert (→ P5)** : page admin, kill-switch UI, `/privacy`, `.env.example`, doc red-team. Maquette assistant à arbitrer par l'orchestrateur (voir encart en tête).
