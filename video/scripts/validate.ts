import { CHAPTERS } from '../scenario/scenario'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

const errors: string[] = []
const frKeys = Object.keys(FR).sort(); const enKeys = Object.keys(EN).sort()
if (JSON.stringify(frKeys) !== JSON.stringify(enKeys)) errors.push('FR/EN keys differ')
for (const ch of CHAPTERS) {
  if (!FR[`chapter.${ch.id}.title`]) errors.push(`missing title: ${ch.id}`)
  for (const b of ch.beats) if (!FR[b.line]) errors.push(`missing line: ${b.line}`)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`OK — ${CHAPTERS.length} chapters, ${frKeys.length} narration keys`)
