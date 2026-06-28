import type { Subject, Publication, Prompt, Member, Task } from '@/types'

export interface RawChunk {
  content: string
}

/** Un chunk par champ logique du sujet (question/accroche/context/method/results), préfixé du titre + kicker pour l'ancrage.
 *  Si `i18n.en` ou `i18n.fr` sont présents, on émet un jeu de chunks par langue (fallback sur les colonnes plates sinon). */
export function chunkSubject(s: Subject): RawChunk[] {
  const base = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const head = s.periode ? `${base} (${s.periode})` : base

  type Set = { question: string; accroche: string; context: string; method: string; results: string }
  const sets: Set[] = []
  const en = s.i18n?.en
  const fr = s.i18n?.fr
  if (en) sets.push({ question: en.question ?? '', accroche: en.accroche ?? '', context: en.context ?? '', method: en.method ?? '', results: en.results ?? '' })
  if (fr) sets.push({ question: fr.question ?? '', accroche: fr.accroche ?? '', context: fr.context ?? '', method: fr.method ?? '', results: fr.results ?? '' })
  if (sets.length === 0) sets.push({ question: s.question, accroche: s.accroche, context: s.context, method: s.method, results: s.results })

  const chunks: RawChunk[] = []
  for (const set of sets) {
    const fields: [string, string][] = [
      ['Question', set.question], ['Accroche', set.accroche],
      ['Context', set.context], ['Method', set.method], ['Results', set.results],
    ]
    for (const [label, v] of fields) {
      if (v && v.trim().length > 0) chunks.push({ content: `${head}\n${label}: ${v.trim()}` })
    }
  }
  return chunks
}

export function chunkPublication(p: Publication): RawChunk[] {
  const parts = [p.titre, p.auteurs.join(', '), String(p.annee), p.revue_ou_conf ?? '', p.type]
    .filter((x) => x && x.length > 0)
  return [{ content: parts.join(' · ') }]
}

export function chunkPrompt(p: Prompt): RawChunk[] {
  return [{ content: `${p.titre}\n${p.texte}`.trim() }]
}

/** Membre : nom, rôle, labo, domaines — JAMAIS l'email (PII). */
export function chunkMember(m: Member): RawChunk[] {
  const domaines = m.domaines.length ? ` — ${m.domaines.join(', ')}` : ''
  return [{ content: `${m.prenom} ${m.nom} (${m.role}, ${m.labo})${domaines}` }]
}

export function chunkTask(t: Task): RawChunk[] {
  const desc = t.description && t.description.trim().length > 0 ? `\n${t.description.trim()}` : ''
  return [{ content: `${t.titre} [${t.statut}]${desc}`.trim() }]
}
