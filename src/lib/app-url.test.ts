import { describe, it, expect, afterEach } from 'vitest'
import { getAppBaseUrl } from './app-url'

const original = process.env.NEXT_PUBLIC_APP_URL
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = original
})

describe('getAppBaseUrl', () => {
  it('renvoie la base sans slash final', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example.com/'
    expect(getAppBaseUrl()).toBe('https://fame.example.com')
  })
  it('renvoie la base telle quelle si pas de slash final', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example.com'
    expect(getAppBaseUrl()).toBe('https://fame.example.com')
  })
  it('lève si la variable est absente', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(() => getAppBaseUrl()).toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
  it('lève si la variable est vide', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    expect(() => getAppBaseUrl()).toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
})
