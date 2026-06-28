'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { validateUpload, SUBJECT_FILES_BUCKET, MAX_FILE_BYTES } from '@/lib/subjects/file-upload'
import type { DropboxLink, SubjectFile } from '@/types'

type Props = {
  links: DropboxLink[]
  files: SubjectFile[]
  subjectId: string
  isMember: boolean
  open: boolean
  onToggleOpen: () => void
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`
  return `${bytes} B`
}

export function FilesPanel({ links, files, subjectId, isMember, open, onToggleOpen }: Props) {
  const t = useTranslations('paper')
  const router = useRouter()
  const { addToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SubjectFile | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    const v = validateUpload({ mimeType: file.type, sizeBytes: file.size, fileName: file.name })
    if (!v.ok) { addToast(file.size > MAX_FILE_BYTES ? t('fileTooLarge') : t('fileTypeNotAllowed'), 'error'); return }
    setBusy(true)
    try {
      const signRes = await fetch(`/api/subjects/${subjectId}/files/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      })
      if (!signRes.ok) throw new Error('sign')
      const { path, token } = await signRes.json()
      const supabase = createClient()
      const up = await supabase.storage.from(SUBJECT_FILES_BUCKET).uploadToSignedUrl(path, token, file)
      if (up.error) throw new Error('upload')
      const regRes = await fetch(`/api/subjects/${subjectId}/files`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      })
      if (!regRes.ok) throw new Error('register')
      router.refresh()
    } catch {
      addToast(t('uploadFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    const f = pendingDelete
    setPendingDelete(null)
    if (!f) return
    const res = await fetch(`/api/subjects/${subjectId}/files/${f.id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    else addToast(t('uploadFailed'), 'error')
  }

  return (
    <section style={{
      flex: 'none', pointerEvents: 'auto', background: '#2f4486', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14, boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button onClick={onToggleOpen} className="text-fame-text-light" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4cd2a0' }} />{t('filesLinks')}
        </span>
        <span className="font-mono text-fame-text-muted" style={{ fontSize: 11 }}>{links.length + files.length} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Liens Dropbox (inchangé) */}
          {links.map(l => (
            <a key={l.id} href={`https://www.dropbox.com/home${l.node_path}`} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, textDecoration: 'none',
              border: '1px solid rgba(150,180,255,0.12)', background: 'rgba(31,46,92,0.5)',
            }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(76,210,160,0.2)', color: '#74e0bb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>◷</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="text-fame-text-light" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.node_name}</span>
              </span>
              <span style={{ color: '#8ea4df', fontSize: 13 }}>↗</span>
            </a>
          ))}

          {/* Fichiers déposés */}
          {files.length > 0 && (
            <p className="font-mono text-fame-text-muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 2px 0' }}>{t('filesUploaded')}</p>
          )}
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10,
              border: '1px solid rgba(150,180,255,0.12)', background: 'rgba(31,46,92,0.5)',
            }}>
              <a href={`/api/subjects/${subjectId}/files/${f.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
                <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(120,160,255,0.2)', color: '#9fb2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⬇</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="text-fame-text-light" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</span>
                  <span className="font-mono text-fame-text-muted" style={{ fontSize: 10 }}>{fmtSize(f.size_bytes)}</span>
                </span>
              </a>
              {isMember && (
                <button onClick={() => setPendingDelete(f)} aria-label={t('deleteFile')} style={{ flex: 'none', background: 'none', border: 'none', color: '#ff8a7d', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          ))}

          {links.length === 0 && files.length === 0 && (
            <p className="font-mono text-fame-text-muted" style={{ fontSize: 10, padding: '4px 2px' }}>{t('dropboxSub')}</p>
          )}

          {/* Dépôt (membres) */}
          {isMember && (
            <>
              <input ref={inputRef} type="file" hidden onChange={onPick}
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.csv,.txt" />
              <button onClick={() => inputRef.current?.click()} disabled={busy} style={{
                marginTop: 4, padding: '9px 11px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                border: '1px dashed rgba(150,180,255,0.35)', background: 'rgba(31,46,92,0.3)', color: '#eef3ff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: busy ? 0.6 : 1,
              }}>{busy ? t('uploading') : `+ ${t('uploadButton')}`}</button>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        message={t('confirmDeleteFile')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
