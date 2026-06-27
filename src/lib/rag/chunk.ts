import type { Subject, Publication, Prompt, Member, Task } from '@/types'

export interface RawChunk {
  content: string
}

/** Un chunk par champ logique du sujet (question/accroche/context/method/results), préfixé du titre + kicker pour l'ancrage. */
export function chunkSubject(s: Subject): RawChunk[] {
  const base = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const head = s.periode ? `${base} (${s.periode})` : base
  const fields: [string, string][] = [
    ['Question', s.question],
    ['Accroche', s.accroche],
    ['Context', s.context],
    ['Method', s.method],
    ['Results', s.results],
  ]
  return fields
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([label, v]) => ({ content: `${head}\n${label}: ${v.trim()}` }))
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
