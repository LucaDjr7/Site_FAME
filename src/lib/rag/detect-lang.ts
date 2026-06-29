// Détection légère EN/FR : accents français + mots-outils. Suffisant pour piloter la
// langue de réponse de l'assistant (pas de dépendance lourde).
const FR_STOPWORDS = /\b(le|la|les|des|une|un|du|de|et|est|sont|quels?|quelles?|pourquoi|comment|sur|avec|pour|dans|vous|nous|votre|qui|que|quoi|où)\b/gi
const EN_STOPWORDS = /\b(the|a|an|of|and|is|are|what|why|how|on|with|for|in|you|we|your|who|which|where|do|does)\b/gi

export function detectLang(text: string): 'en' | 'fr' {
  const t = (text ?? '').toLowerCase()
  if (/[àâäçéèêëîïôöùûü]/.test(t)) return 'fr'
  const fr = (t.match(FR_STOPWORDS) ?? []).length
  const en = (t.match(EN_STOPWORDS) ?? []).length
  return fr > en ? 'fr' : 'en'
}
