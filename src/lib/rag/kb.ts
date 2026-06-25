import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RawChunk } from './chunk'

export interface KbDoc {
  slug: string
  lang: string
  labo: 'paris' | 'montreal' | null
  chunks: RawChunk[]
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body: m[2] ?? '' }
}

export function parseKbFile(slug: string, raw: string): KbDoc {
  const { meta, body } = parseFrontmatter(raw)
  const lang = meta.lang || 'en'
  const labo = meta.labo === 'paris' || meta.labo === 'montreal' ? meta.labo : null
  // Découpe par titres de niveau 2 (## ...). Le préambule (avant le 1er ##) forme un chunk.
  const sections = body.split(/\n(?=## )/).map(s => s.trim()).filter(s => s.length > 0)
  const chunks: RawChunk[] = sections.map(content => ({ content }))
  return { slug, lang, labo, chunks }
}

export async function loadKbDir(dir: string): Promise<KbDoc[]> {
  let files: string[]
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.md'))
  } catch {
    return []
  }
  const docs: KbDoc[] = []
  for (const f of files) {
    const raw = await readFile(join(dir, f), 'utf8')
    docs.push(parseKbFile(f.replace(/\.md$/, ''), raw))
  }
  return docs
}
