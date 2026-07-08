// Génère les WAV de narration (une voix par locale) avec cache par hash de texte.
// Run: npm run tts            (les deux locales)
//      npm run tts -- fr      (une locale)
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import OpenAI from 'openai'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'
import { wavDurationMs } from './wav'

config({ path: ['../.env.local', '../.env'] })
if (!process.env.OPENAI_API_KEY) { console.error('Set OPENAI_API_KEY in ../.env.local'); process.exit(1) }

const openai = new OpenAI()
const VOICES: Record<string, string> = { fr: 'nova', en: 'alloy' }
const SOURCES: Record<string, Record<string, string>> = { fr: FR, en: EN }
const locales = process.argv[2] ? [process.argv[2]] : ['fr', 'en']

type Manifest = Record<string, { hash: string; durationMs: number }>

for (const locale of locales) {
  const dir = `audio/${locale}`
  mkdirSync(dir, { recursive: true })
  const manifestPath = `${dir}/manifest.json`
  const manifest: Manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}

  for (const [id, text] of Object.entries(SOURCES[locale])) {
    if (id.startsWith('chapter.')) continue // titres de cartes : pas de voix
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)
    if (manifest[id]?.hash === hash && existsSync(`${dir}/${id}.wav`)) continue
    console.log(`[${locale}] ${id} …`)
    const res = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts', voice: VOICES[locale], input: text, response_format: 'wav',
      instructions: 'Enthusiastic but clear tour-guide voice, natural pace.',
    })
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(`${dir}/${id}.wav`, buf)
    manifest[id] = { hash, durationMs: wavDurationMs(buf) }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  }
  const total = Object.values(manifest).reduce((s, m) => s + m.durationMs, 0)
  console.log(`[${locale}] total narration: ${(total / 1000).toFixed(1)}s`)
}
