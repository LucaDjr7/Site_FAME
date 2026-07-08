// Prépare video/public/ (liens vers audio/ et recordings/), rend les 2 MP4,
// écrit les chapters.<locale>.json (timecodes des cartes de chapitres).
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeSchedule, type TimelineJson } from '../src/timing'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

const locales = (process.argv[2] ? [process.argv[2]] : ['fr', 'en']) as Array<'fr' | 'en'>

rmSync('public', { recursive: true, force: true })
mkdirSync('public', { recursive: true })
symlinkSync(resolve('audio'), resolve('public/audio'))
symlinkSync(resolve('recordings'), resolve('public/recordings'))
mkdirSync('out', { recursive: true })

for (const locale of locales) {
  execSync(`npx remotion render src/index.ts GuideVideo-${locale} out/fame-guide-${locale}.mp4`, { stdio: 'inherit' })
  const timeline = JSON.parse(readFileSync(`recordings/${locale}/timeline.json`, 'utf8')) as TimelineJson
  const narration = locale === 'fr' ? FR : EN
  const chapters = computeSchedule(timeline, 30).chapters.map(ch => ({
    id: ch.id, title: narration[`chapter.${ch.id}.title`], startSeconds: Math.floor(ch.cardFrom / 30),
  }))
  writeFileSync(`out/chapters.${locale}.json`, JSON.stringify(chapters, null, 2))
  console.log(`[${locale}] out/fame-guide-${locale}.mp4 + chapters (${chapters.length})`)
}
