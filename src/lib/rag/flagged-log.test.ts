import { describe, it, expect } from 'vitest'
import { logFlagged, logUnanswered } from './flagged-log'

function makeService() {
  const inserted: Record<string, unknown>[] = []
  const service = {
    from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return {} } }),
  }
  return { service, inserted }
}

describe('flagged-log — masquage PII', () => {
  it('logFlagged masque un email présent dans la question', async () => {
    const { service, inserted } = makeService()
    await logFlagged('contact me at john.doe@example.com please', 'spam', 'h:1', { service })
    expect(inserted).toHaveLength(1)
    const q = inserted[0]!.question as string
    expect(q).not.toContain('john.doe@example.com')
    expect(q).toContain('[redacted]')
  })

  it('logUnanswered masque un email présent dans la question', async () => {
    const { service, inserted } = makeService()
    await logUnanswered('reach jane@example.org about X', 'en', 'h:1', { service })
    expect(inserted).toHaveLength(1)
    const q = inserted[0]!.question as string
    expect(q).not.toContain('jane@example.org')
    expect(q).toContain('[redacted]')
  })

  it('conserve la troncature à 2000 caractères', async () => {
    const { service, inserted } = makeService()
    await logFlagged('a'.repeat(3000), 'spam', 'h:1', { service })
    expect((inserted[0]!.question as string).length).toBe(2000)
  })
})
