export const SUBJECT_FILES_BUCKET = 'subject-files'
export const MAX_FILE_BYTES = 52428800 // 50 Mo

// Liste blanche MIME → extension (défense côté app, en plus du bucket).
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
}

export function validateUpload(
  input: { mimeType?: unknown; sizeBytes?: unknown; fileName?: unknown },
): { ok: true } | { ok: false; error: string } {
  const { mimeType, sizeBytes, fileName } = input
  if (typeof fileName !== 'string' || !fileName.trim()) return { ok: false, error: 'file_name required' }
  if (typeof mimeType !== 'string' || !(mimeType in ALLOWED_MIME)) return { ok: false, error: 'unsupported file type' }
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: 'invalid size' }
  if (sizeBytes > MAX_FILE_BYTES) return { ok: false, error: 'file too large' }
  return { ok: true }
}
