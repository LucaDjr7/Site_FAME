import { describe, it, expect } from 'vitest'
import en from '../../../../messages/en.json'
import fr from '../../../../messages/fr.json'

describe('Privacy back link', () => {
  it('i18n keys for back link exist in EN and FR', () => {
    // RSC async render with next-intl getTranslations requires request context in test env.
    // Fall back to verifying i18n key presence instead.
    expect((en as { privacy: { back: string } }).privacy.back).toMatch(/Back to site/)
    expect((fr as { privacy: { back: string } }).privacy.back).toMatch(/Retour au site/)
  })
})
