import { describe, it, expect } from 'vitest'
import { dateBucket } from './utils'

describe('dateBucket', () => {
  it('classe par année', () => {
    expect(dateBucket('2025-03-01')).toBe('2025')
    expect(dateBucket('2024-12-31')).toBe('2024')
    expect(dateBucket('2019-01-01')).toBe('older')
  })
})
