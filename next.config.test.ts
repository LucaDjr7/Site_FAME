import { describe, it, expect } from 'vitest'
import config from './next.config'

describe('security headers', () => {
  it('définit les en-têtes de sécurité', async () => {
    const headers = await (config.headers as () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>)()
    const keys = headers[0].headers.map(h => h.key)
    expect(keys).toEqual(expect.arrayContaining(['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']))
  })
})
