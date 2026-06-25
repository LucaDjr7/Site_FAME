import { describe, it, expect, beforeEach } from 'vitest'
import sitemap from './sitemap'

beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example' })

describe('sitemap', () => {
  it('couvre les routes publiques pour chaque locale et chaque lab', () => {
    const urls = sitemap().map(e => e.url)
    // home par locale
    expect(urls).toContain('https://fame.example/en')
    expect(urls).toContain('https://fame.example/fr')
    // lab grid + sous-pages publiques par lab/locale
    expect(urls).toContain('https://fame.example/en/paris')
    expect(urls).toContain('https://fame.example/fr/montreal')
    expect(urls).toContain('https://fame.example/en/paris/publications')
    expect(urls).toContain('https://fame.example/en/paris/team')
    expect(urls).toContain('https://fame.example/en/paris/propose')
    expect(urls).toContain('https://fame.example/en/paris/tasks')
  })
  it('exclut les routes authentifiées et admin', () => {
    const urls = sitemap().map(e => e.url)
    expect(urls.some(u => u.includes('/admin'))).toBe(false)
    expect(urls.some(u => u.includes('/auth'))).toBe(false)
    expect(urls.some(u => u.includes('/data'))).toBe(false)
    expect(urls.some(u => u.includes('/prompts'))).toBe(false)
  })
})
