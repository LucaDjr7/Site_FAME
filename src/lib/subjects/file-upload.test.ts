import { describe, it, expect } from 'vitest'
import { validateUpload, MAX_FILE_BYTES, ALLOWED_MIME } from './file-upload'

describe('validateUpload', () => {
  it('accepte un PDF valide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 1000, fileName: 'a.pdf' }))
      .toEqual({ ok: true })
  })
  it('refuse un type non autorisé', () => {
    const r = validateUpload({ mimeType: 'application/x-msdownload', sizeBytes: 10, fileName: 'a.exe' })
    expect(r.ok).toBe(false)
  })
  it('refuse un fichier trop volumineux', () => {
    const r = validateUpload({ mimeType: 'application/pdf', sizeBytes: MAX_FILE_BYTES + 1, fileName: 'a.pdf' })
    expect(r.ok).toBe(false)
  })
  it('refuse un nom vide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 10, fileName: '  ' }).ok).toBe(false)
  })
  it('refuse une taille invalide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 0, fileName: 'a.pdf' }).ok).toBe(false)
  })
  it('expose png/jpeg/docx dans la liste blanche', () => {
    expect(ALLOWED_MIME['image/png']).toBeDefined()
    expect(ALLOWED_MIME['image/jpeg']).toBeDefined()
    expect(ALLOWED_MIME['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBeDefined()
  })
})
