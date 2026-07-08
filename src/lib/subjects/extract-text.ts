import { unzipSync, strFromU8 } from 'fflate'

const MAX_CHARS = 200_000

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Concatène le texte des nœuds <tag>…</tag> d'un XML, en retirant les balises internes.
function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[1]) out.push(m[1].replace(/<[^>]+>/g, ''))
  }
  return out.join(' ')
}

function unzipText(bytes: Uint8Array, match: (name: string) => boolean, tag: string): string {
  const files = unzipSync(bytes)
  const parts: string[] = []
  let total = 0
  for (const name of Object.keys(files)) {
    if (!match(name)) continue
    const file = files[name]
    if (!file) continue
    parts.push(xmlText(strFromU8(file), tag))
    total += file.length
    // Garde-fou : au-delà de MAX_CHARS de contenu inspecté on s'arrête — le texte est de
    // toute façon tronqué à MAX_CHARS ensuite, inutile de traiter des archives gonflées.
    if (total >= MAX_CHARS) break
  }
  return parts.join('\n')
}

export async function extractText(bytes: Uint8Array, mime: string): Promise<string> {
  try {
    let text = ''
    if (mime === 'text/plain' || mime === 'text/csv') {
      text = new TextDecoder().decode(bytes)
    } else if (mime === 'application/pdf') {
      const { getDocumentProxy, extractText: pdfExtract } = await import('unpdf')
      const pdf = await getDocumentProxy(bytes)
      const r = await pdfExtract(pdf, { mergePages: true })
      text = Array.isArray(r.text) ? r.text.join('\n') : r.text
    } else if (mime === DOCX) {
      text = unzipText(bytes, (n) => n === 'word/document.xml', 'w:t')
    } else if (mime === PPTX) {
      text = unzipText(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n), 'a:t')
    } else if (mime === XLSX) {
      text = unzipText(bytes, (n) => n === 'xl/sharedStrings.xml', 't')
    }
    return text.slice(0, MAX_CHARS).trim()
  } catch (e) {
    console.error('extractText failed', mime, e instanceof Error ? e.message : e)
    return ''
  }
}
