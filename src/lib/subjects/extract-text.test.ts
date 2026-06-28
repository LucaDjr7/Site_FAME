import { describe, it, expect, vi } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { extractText } from './extract-text'

vi.mock('unpdf', () => ({
  getDocumentProxy: async () => ({}),
  extractText: async () => ({ totalPages: 1, text: 'Texte du PDF' }),
}))

describe('extractText', () => {
  it('décode txt et csv', async () => {
    expect(await extractText(strToU8('bonjour'), 'text/plain')).toBe('bonjour')
    expect(await extractText(strToU8('a,b,c'), 'text/csv')).toBe('a,b,c')
  })
  it('extrait un docx (<w:t>)', async () => {
    const docx = zipSync({ 'word/document.xml': strToU8('<w:body><w:p><w:r><w:t>Hello docx</w:t></w:r></w:p></w:body>') })
    expect(await extractText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toContain('Hello docx')
  })
  it('extrait un pptx (<a:t>)', async () => {
    const pptx = zipSync({ 'ppt/slides/slide1.xml': strToU8('<p:sld><a:t>Slide text</a:t></p:sld>') })
    expect(await extractText(pptx, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toContain('Slide text')
  })
  it('extrait un xlsx (sharedStrings <t>)', async () => {
    const xlsx = zipSync({ 'xl/sharedStrings.xml': strToU8('<sst><si><t>Cell value</t></si></sst>') })
    expect(await extractText(xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toContain('Cell value')
  })
  it('extrait un pdf (lib mockée)', async () => {
    expect(await extractText(new Uint8Array([1, 2, 3]), 'application/pdf')).toBe('Texte du PDF')
  })
  it('renvoie vide pour un type inconnu', async () => {
    expect(await extractText(strToU8('x'), 'image/png')).toBe('')
  })
})
