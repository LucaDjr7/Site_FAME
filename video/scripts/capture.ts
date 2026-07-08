// Capture le screencast chapitre par chapitre, calé sur les durées TTS.
// Prérequis : site sur http://localhost:3000, seed démo appliqué, TTS généré.
// Run: npm run capture -- fr            (une locale)
//      npm run capture                  (les deux)
//      npm run capture -- fr tour       (un seul chapitre — itération sélecteurs)
import { config } from 'dotenv'
import { chromium, type Page } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { CHAPTERS, BASE_LAB } from '../scenario/scenario'
import type { Chapter, Action } from '../scenario/types'
import { CURSOR_INIT_SCRIPT } from './cursor'
import { DEMO_MEMBER_EMAIL } from '../../src/scripts/seed-demo-data'

config({ path: ['../.env.local', '../.env'] })

export const PAD_MS = 700 // respiration après chaque ligne de narration
const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000'
const SIZE = { width: 1920, height: 1080 }

type Manifest = Record<string, { hash: string; durationMs: number }>
export interface TimelineBeat { line: string; startMs: number; durationMs: number }
export interface Timeline { chapters: Array<{ id: string; durationMs: number; beats: TimelineBeat[] }> }

export function buildTimeline(chapters: ReadonlyArray<Pick<Chapter, 'id' | 'beats'>>, manifest: Manifest, padMs: number): Timeline {
  return {
    chapters: chapters.map(ch => {
      let cursor = 0
      const beats = ch.beats.map(b => {
        const entry = manifest[b.line]
        if (!entry) throw new Error(`No audio for line: ${b.line}`)
        const beat = { line: b.line, startMs: cursor, durationMs: entry.durationMs + padMs }
        cursor += beat.durationMs
        return beat
      })
      return { id: ch.id, durationMs: cursor, beats }
    }),
  }
}

async function runAction(page: Page, a: Action, locale: string) {
  switch (a.kind) {
    case 'goto':
      await page.goto(`${BASE_URL}${a.path.replaceAll('{locale}', locale)}`, { waitUntil: 'networkidle' })
      break
    case 'click': {
      const el = page.locator(a.selector).first()
      const box = await el.boundingBox()
      if (box) {
        const x = box.x + box.width / 2, y = box.y + box.height / 2
        await page.evaluate(([px, py]) => (window as never as { __fameCursor: { move(x: number, y: number): void } }).__fameCursor.move(px, py), [x, y] as const)
        await page.waitForTimeout(400)
        await page.evaluate(() => (window as never as { __fameCursor: { pulse(): void } }).__fameCursor.pulse())
        // Clic souris brut (pas locator.click()) : certains éléments animés en continu
        // (ex. pins du globe, transform muté à chaque frame de rotation) ne satisfont
        // jamais le contrôle de stabilité de Playwright ("élément immobile 2 frames de
        // suite") et le clic timeout indéfiniment. Le curseur factice a déjà positionné
        // le point ci-dessus ; on clique réellement à ce point plutôt que de raffiner
        // via l'engine d'actionability du locator.
        // La bbox mesurée ci-dessus date d'avant le déplacement du curseur factice + le
        // pulse (~400-600ms) : sur une cible animée en continu (pin du globe qui tourne,
        // transform muté chaque frame) elle a pu bouger entre-temps. On re-mesure juste
        // avant le clic réel pour utiliser des coordonnées fraîches ; seul le curseur
        // factice ci-dessus se contente de la 1re mesure (juste indicatif visuellement).
        const freshBox = (await el.boundingBox()) ?? box
        const fx = freshBox.x + freshBox.width / 2, fy = freshBox.y + freshBox.height / 2
        await page.mouse.move(fx, fy)
        await page.mouse.down()
        await page.mouse.up()
      } else {
        // Élément hors écran / bbox indisponible : repli sur le comportement standard.
        await el.click()
      }
      break
    }
    case 'type': await page.locator(a.selector).first().pressSequentially(a.text, { delay: 55 }); break
    case 'hover': {
      const el = page.locator(a.selector).first()
      const box = await el.boundingBox()
      if (box) {
        const x = box.x + box.width / 2, y = box.y + box.height / 2
        await page.evaluate(([px, py]) => (window as never as { __fameCursor: { move(x: number, y: number): void } }).__fameCursor.move(px, py), [x, y] as const)
        // Même repli que 'click' : mouse.move brut plutôt que locator.hover(), pour
        // les mêmes raisons de stabilité sur des éléments animés en continu.
        // Re-mesure juste avant le mouse.move réel (voir commentaire équivalent dans 'click').
        const freshBox = (await el.boundingBox()) ?? box
        const fx = freshBox.x + freshBox.width / 2, fy = freshBox.y + freshBox.height / 2
        await page.mouse.move(fx, fy)
      } else {
        await el.hover()
      }
      break
    }
    case 'scroll': await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), a.y); break
    case 'pause': await page.waitForTimeout(a.ms); break
  }
}

async function login(locale: string): Promise<string> {
  // Connexion via l'UI une fois par locale → storageState réutilisé par chapitre.
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password) throw new Error('Set SEED_DEMO_PASSWORD in ../.env.local')
  mkdirSync('.auth', { recursive: true })
  const statePath = `.auth/${locale}.json`
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${BASE_URL}/${locale}/auth/login`)
    await page.locator('input[type="email"]').fill(DEMO_MEMBER_EMAIL)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 15000 })
    await page.context().storageState({ path: statePath })
    return statePath
  } finally {
    await browser.close()
  }
}

async function captureChapter(chapter: Chapter, locale: string, manifest: Manifest, statePath: string) {
  const dir = `recordings/${locale}`
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: SIZE, recordVideo: { dir, size: SIZE }, storageState: statePath, locale,
    })
    try {
      await context.addInitScript(CURSOR_INIT_SCRIPT)
      const page = await context.newPage()
      const tl = buildTimeline([chapter], manifest, PAD_MS).chapters[0]
      if (!tl) throw new Error(`no timeline built for chapter ${chapter.id}`)
      const video = page.video()

      const t0 = Date.now()
      for (const [i, beat] of chapter.beats.entries()) {
        const target = tl.beats[i]
        if (!target) throw new Error(`beat index ${i} missing from timeline`)
        for (const a of beat.actions) await runAction(page, a, locale)
        // Attendre la fin du beat (la voix + le padding) avant le suivant
        const remaining = target.startMs + target.durationMs - (Date.now() - t0)
        if (remaining > 0) {
          await page.waitForTimeout(remaining)
        } else {
          console.warn(`[${locale}] ${chapter.id}: beat "${beat.line}" a dépassé son budget de ${-remaining}ms`)
        }
      }
      await context.close() // flush le webm — même en cas d'erreur ci-dessus, le finally ci-dessous s'en charge (webm partiel utile au debug)
      if (!video) throw new Error(`[${locale}] ${chapter.id}: aucune vidéo Playwright (page.video() est null) — recordVideo mal configuré ?`)
      renameSync(await video.path(), `${dir}/${chapter.id}.webm`)
      console.log(`[${locale}] ${chapter.id}: ${(tl.durationMs / 1000).toFixed(1)}s`)
      return tl
    } finally {
      // context.close() est idempotent côté Playwright (no-op si déjà fermé) : filet de
      // sécurité si une erreur a interrompu le corps avant le close() explicite ci-dessus,
      // pour garder un webm partiel exploitable en debug.
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const [localeArg, chapterArg] = process.argv.slice(2)
  const locales = localeArg ? [localeArg] : ['fr', 'en']
  for (const locale of locales) {
    const manifest: Manifest = JSON.parse(readFileSync(`audio/${locale}/manifest.json`, 'utf8'))
    const statePath = existsSync(`.auth/${locale}.json`) ? `.auth/${locale}.json` : await login(locale)
    const chapters = chapterArg ? CHAPTERS.filter(c => c.id === chapterArg) : CHAPTERS
    const done: Timeline['chapters'] = []
    for (const ch of chapters) done.push(await captureChapter(ch, locale, manifest, statePath))
    if (!chapterArg) {
      writeFileSync(`recordings/${locale}/timeline.json`, JSON.stringify({ chapters: done }, null, 2))
      console.log(`[${locale}] timeline.json written (${done.length} chapters)`)
    }
  }
  console.log(`BASE_LAB=${BASE_LAB} — done`)
}

// Ne lancer main() que hors vitest (le test importe buildTimeline/PAD_MS)
if (!process.env.VITEST) main().catch(err => { console.error(err); process.exit(1) })
