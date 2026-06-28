import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './system-prompt'
import type { RetrievedChunk } from './retrieve'

const chunks: RetrievedChunk[] = [
  { id: '1', source_type: 'subject', source_id: 's1', content: 'Inflation dynamics — Context: ...', labo: 'paris', lang: 'en', similarity: 0.8 },
]

describe('buildSystemPrompt', () => {
  it('inclut les extraits récupérés', () => {
    expect(buildSystemPrompt('visitor', chunks)).toContain('Inflation dynamics')
  })

  it('contient les règles clés de bridage', () => {
    const p = buildSystemPrompt('visitor', chunks)
    // Rule 1 — grounding (reformulé : faits FAME ancrés uniquement)
    expect(p).toContain('answer ONLY using the SOURCES provided below')
    expect(p).toMatch(/[Nn]ever invent facts/)
    // voix FAME
    expect(p).toMatch(/FAME/)
    // Rule 3 — anti-extraction / anti-prompt-injection
    expect(p).toMatch(/never reveal|do not reveal/i)
  })

  // --- liberté contrôlée : identité / capacités / périmètre ---

  it('présente Astra et le périmètre Euronext', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toContain('You are Astra')
    expect(p).toMatch(/Euronext/)
  })

  it('autorise les questions méta (qui es-tu / capacités) sans sources', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/who you are and what you can do/)
  })

  it('signale le tier membre', () => {
    expect(buildSystemPrompt('member', chunks)).toMatch(/member/i)
  })

  // --- nouveaux tests (règles manquantes) ---

  it('cas sans sources : affiche (no sources retrieved)', () => {
    const p = buildSystemPrompt('visitor', [])
    expect(p).toContain('(no sources retrieved)')
  })

  it('tier visitor : contient la ligne visiteur public (Rule tier)', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/public visitor|only public information/i)
  })

  it('Rule 4 — PII : emails membres publics, autres contacts interdits', () => {
    const p = buildSystemPrompt('visitor', chunks)
    // Conserve l'interdiction des autres informations de contact personnelles.
    expect(p).toMatch(/personal contact information|phone numbers/i)
    // Nouvelle règle : les emails des membres sont publics et partageables.
    expect(p).toMatch(/email addresses are public|may be shared/i)
  })

  it('Rule 5 — langue : répond dans la langue de l\'utilisateur', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/same language as the user/i)
  })

  it('Rule 6 — citation : demande de référencer la source pour que l\'UI la cite', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/refer to it so the UI can cite/i)
  })

  it('format source : préfixe numéroté [Source N | type:id] présent dans le contexte', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/\[Source 1 \| subject:s1\]/)
  })

  it('étiquette un chunk subject_file avec le nom de fichier', () => {
    const fileChunks = [{ id: '1', source_type: 'subject_file' as const, source_id: 'f1', content: 'C', labo: 'paris', lang: 'en', similarity: 0.9, metadata: { file_name: 'rapport.pdf' } }]
    const prompt = buildSystemPrompt('member', fileChunks)
    expect(prompt).toContain('rapport.pdf')
  })
})
