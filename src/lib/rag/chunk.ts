import type { Subject, Publication, Prompt, Member, Task } from '@/types'

export interface RawChunk {
  content: string
  lang?: string
}

/** Un chunk par champ logique du sujet (question/accroche/context/method/results), préfixé du titre + kicker pour l'ancrage.
 *  Si `i18n.en` ou `i18n.fr` sont présents, on émet un jeu de chunks par langue (fallback sur les colonnes plates sinon). */
export function chunkSubject(s: Subject): RawChunk[] {
  const base = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const head = s.periode ? `${base} (${s.periode})` : base

  type FieldSet = { lang?: string; question: string; accroche: string; context: string; method: string; results: string }
  const sets: FieldSet[] = []
  const en = s.i18n?.en
  const fr = s.i18n?.fr
  if (en) sets.push({ lang: 'en', question: en.question ?? '', accroche: en.accroche ?? '', context: en.context ?? '', method: en.method ?? '', results: en.results ?? '' })
  if (fr) sets.push({ lang: 'fr', question: fr.question ?? '', accroche: fr.accroche ?? '', context: fr.context ?? '', method: fr.method ?? '', results: fr.results ?? '' })
  if (sets.length === 0) sets.push({ question: s.question, accroche: s.accroche, context: s.context, method: s.method, results: s.results })

  const chunks: RawChunk[] = []
  for (const set of sets) {
    const fields: [string, string][] = [
      ['Question', set.question], ['Accroche', set.accroche],
      ['Context', set.context], ['Method', set.method], ['Results', set.results],
    ]
    for (const [label, v] of fields) {
      if (v && v.trim().length > 0) chunks.push({ content: `${head}\n${label}: ${v.trim()}`, lang: set.lang })
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
  const sets: { lang?: string; titre: string; description: string }[] = []
  const en = t.i18n?.en
  const fr = t.i18n?.fr
  if (en) sets.push({ lang: 'en', titre: en.titre ?? t.titre, description: en.description ?? '' })
  if (fr) sets.push({ lang: 'fr', titre: fr.titre ?? t.titre, description: fr.description ?? '' })
  if (sets.length === 0) sets.push({ titre: t.titre, description: t.description })

  return sets.map(set => {
    const desc = set.description && set.description.trim().length > 0 ? `\n${set.description.trim()}` : ''
    return { content: `${set.titre} [${t.statut}]${desc}`.trim(), lang: set.lang }
  })
}

/** Découpe un texte libre en segments ~`size` caractères avec `overlap` de chevauchement,
 *  en cherchant une frontière (saut de ligne / phrase / espace) près de la fin de chaque segment. */
export function chunkText(text: string, size = 1500, overlap = 150): RawChunk[] {
  const t = text.trim()
  if (!t) return []
  const chunks: RawChunk[] = []
  let i = 0
  while (i < t.length) {
    let end = Math.min(i + size, t.length)
    if (end < t.length) {
      const slice = t.slice(i, end)
      const br = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '))
      if (br > size - 200) end = i + br + 1
    }
    const content = t.slice(i, end).trim()
    if (content) chunks.push({ content })
    if (end >= t.length) break
    i = Math.max(end - overlap, i + 1)
  }
  return chunks
}
