'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import type { Comment } from '@/types'

type Props = {
  subjectId: string
  isMember: boolean
  initialComments: Comment[]
  open: boolean
  onToggleOpen: () => void
}

export function CommentsPanel({ subjectId, isMember, initialComments, open, onToggleOpen }: Props) {
  const t = useTranslations('paper')
  const tc = useTranslations('comments')
  const { addToast } = useToast()
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [draft, setDraft] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [posting, setPosting] = useState(false)

  async function addComment() {
    const text = draft.trim()
    if (!text || posting) return
    if (!isMember && (!firstName.trim() || !lastName.trim())) return
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet_id: subjectId, texte: text, visitor_prenom: firstName, visitor_nom: lastName }),
      })
      if (!res.ok) throw new Error('post failed')
      const created: Comment = await res.json()
      setComments(prev => [...prev, created])
      setDraft('')
      if (!isMember) {
        setFirstName('')
        setLastName('')
        addToast(t('commentPosted'), 'success')
      }
    } catch {
      addToast(tc('error'), 'error')
    } finally {
      setPosting(false)
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {
      addToast(tc('error'), 'error')
    }
  }

  return (
    <section style={{
      flex: 'none', pointerEvents: 'auto', background: 'rgba(47,68,134,0.84)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14, boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button onClick={onToggleOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#eef3ff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f4b740' }} />{t('comments')}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#7e95d6' }}>{comments.length} {open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div>
          <div className="fame-scroll" style={{ maxHeight: 210, overflowY: 'auto', padding: '2px 14px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 9 }}>
                <Avatar name={c.auteur_nom} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#dfe7fb' }}>{c.auteur_nom}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#7e95d6' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    {isMember && (
                      <button onClick={() => remove(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#ff6f61' }}>{tc('delete')}</button>
                    )}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.45, color: '#b9c5ec' }}>{c.texte}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#7e95d6', padding: '4px 2px' }}>{t('noComments')}</p>}
          </div>

          <div style={{ padding: '10px 12px 13px', borderTop: '1px solid rgba(150,180,255,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!isMember && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={tc('firstName')} aria-label={t('commentNameLabel')} style={inputStyle} />
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={tc('lastName')} aria-label={t('commentNameLabel')} style={inputStyle} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {isMember ? (
                <textarea
                  value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                  placeholder={t('addComment')} aria-label={t('commentTextLabel')}
                  rows={3}
                  style={{ ...inputStyle, flex: 1, resize: 'none' }}
                />
              ) : (
                <input
                  value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment() } }}
                  placeholder={t('addComment')} aria-label={t('commentTextLabel')} style={{ ...inputStyle, flex: 1 }}
                />
              )}
              <button onClick={addComment} disabled={posting} aria-label={tc('post')} style={{ flex: 'none', background: 'rgba(120,150,255,0.24)', border: '1px solid rgba(150,180,255,0.32)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, width: 36, height: 36 }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  minWidth: 0, background: 'rgba(31,46,92,0.6)', border: '1px solid rgba(150,180,255,0.16)',
  borderRadius: 8, outline: 'none', color: '#eef3ff', fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11, padding: '8px 10px',
}
