import { describe, it, expect } from 'vitest'
import { VALID_LABS, LAB_LABELS, FAME_PAGE_BG } from './constants'

describe('constantes labo', () => {
  it('VALID_LABS = paris, montreal', () => expect(VALID_LABS).toEqual(['paris', 'montreal']))
  it('LAB_LABELS mappe les libellés', () => { expect(LAB_LABELS.paris).toBe('Paris'); expect(LAB_LABELS.montreal).toBe('Montréal') })
  it('FAME_PAGE_BG contient le gradient canonique', () => { expect(FAME_PAGE_BG).toContain('rgba(181,157,135'); expect(FAME_PAGE_BG).toContain('#F9F9FA') })
})
