'use client'
import { Modal } from './Modal'
import { useTranslations } from 'next-intl'

type Props = {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ open, message, onConfirm, onCancel, danger = true }: Props) {
  const t = useTranslations('common')
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="text-fame-blue-dark mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm border border-fame-ecru hover:bg-fame-ecru">
          {t('cancel')}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded text-sm text-white font-medium ${danger ? 'bg-fame-red hover:bg-fame-red/90' : 'bg-fame-blue hover:bg-fame-blue-dark'}`}
        >
          {t('confirm')}
        </button>
      </div>
    </Modal>
  )
}
