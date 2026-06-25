import { describe, it, expect, beforeEach } from 'vitest'
import robots from './robots'

beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example' })

describe('robots', () => {
  it('autorise / et interdit les zones privées, référence le sitemap', () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule?.allow).toBe('/')
    expect(rule?.disallow).toEqual(expect.arrayContaining(['/api/', '/en/admin', '/fr/admin']))
    expect(r.sitemap).toBe('https://fame.example/sitemap.xml')
  })
})
