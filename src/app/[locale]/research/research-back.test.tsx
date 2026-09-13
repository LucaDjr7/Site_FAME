import { describe, it, expect } from 'vitest'
import en from '../../../../messages/en.json'
import fr from '../../../../messages/fr.json'

// /research sits outside [locale]/[lab]/ so it renders without a TopBar/NavMenu —
// same situation as [locale]/privacy, same back-link treatment, same test shape
// (an RSC async render with getTranslations needs request context, unavailable
// here, so the i18n keys are what gets asserted).
describe('Research page back link', () => {
  it('i18n keys for the back link exist in EN and FR', () => {
    expect(en.research.back).toMatch(/Back to site/)
    expect(fr.research.back).toMatch(/Retour au site/)
  })

  it('has a distinct load-error message so a failed query never reads as "no papers yet"', () => {
    expect(en.research.loadError).toBeTruthy()
    expect(en.research.loadError).not.toBe(en.research.empty)
    expect(fr.research.loadError).toBeTruthy()
    expect(fr.research.loadError).not.toBe(fr.research.empty)
  })
})
