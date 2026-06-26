import { describe, it, expect } from 'vitest'
import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'

const KEYS = [
  'title','subtitle','beta','assistantName','you','openLabel','closeLabel','fullscreenLabel','newChat',
  'placeholder','send','thinking','greetingVisitor','greetingMember','welcomeTitle','welcomeBody',
  'suggestionsLabel','suggestion1','suggestion2','suggestion3','suggestion4',
  'sources','unanswered','proposeCta','degraded','error','rateLimited','disclaimer','globeCta','globeCtaSub',
  'teaserBadge',
]

type Messages = { assistant: Record<string, string> }

describe('i18n assistant parity', () => {
  it('en a le namespace assistant avec toutes les clés', () => {
    const a = (en as unknown as Messages).assistant
    for (const k of KEYS) expect(a, `en.assistant.${k}`).toHaveProperty(k)
  })
  it('fr reflète exactement les clés de en', () => {
    const ea = Object.keys((en as unknown as Messages).assistant).sort()
    const fa = Object.keys((fr as unknown as Messages).assistant).sort()
    expect(fa).toEqual(ea)
  })
})
