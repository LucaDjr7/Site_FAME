'use client'
import { useTranslations, useLocale } from 'next-intl'
import type { Subject } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { SUBJECT_STATUS_COLOR } from './kanban-shared'
import { localizedSubject, toLocale2 } from '@/lib/subjects/localized'

type Props = {
  open: boolean
  subjects: Subject[]
  onClose: () => void
  onAdd: (subjectId: string) => void
}

export function AddSubjectModal({ open, subjects, onClose, onAdd }: Props) {
  const t = useTranslations('tasks')
  const loc = toLocale2(useLocale())

  return (
    <Modal open={open} onClose={onClose} title={t('addSubjectModal.title')}>
      {subjects.length === 0 ? (
        <p className="font-mono text-fame-text-muted" style={{ fontSize: 12 }}>{t('addSubjectModal.empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
          {subjects.map(s => (
            <button key={s.id} type="button" className="font-mono text-fame-text-body"
              onClick={() => onAdd(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6,
                border: '1px solid rgba(87,104,172,0.25)', background: 'transparent', cursor: 'pointer',
                textAlign: 'left', fontSize: 12,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SUBJECT_STATUS_COLOR[s.statut], flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {localizedSubject(s, loc).titre}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
