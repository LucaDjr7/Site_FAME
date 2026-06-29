// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { TaskModal } from './TaskModal'
import en from '../../../messages/en.json'
import type { TaskWithRelations } from '@/types'

const task: TaskWithRelations = {
  id: 't1', labo: 'paris', titre: 'Build', description: 'Do it', statut: 'to-do', difficulte: 'easy',
  sujet_id: 's', date_creation: '', date_echeance: null, i18n: {}, assignees: [], subtasks: [],
}
function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>)
}

describe('TaskModal edition', () => {
  it('un membre peut éditer le titre et déclenche onPatch', () => {
    const onPatch = vi.fn()
    wrap(<TaskModal task={task} subjectTitle="S" isMember currentMemberId="m" onClose={() => {}} onPatch={onPatch} onToggleSubtask={() => {}} onClaim={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: en.tasks.editTitle }))
    const input = screen.getByDisplayValue('Build')
    fireEvent.change(input, { target: { value: 'Build v2' } })
    fireEvent.click(screen.getByRole('button', { name: en.tasks.editor.save }))
    expect(onPatch).toHaveBeenCalledWith('t1', expect.objectContaining({ titre: 'Build v2' }))
  })
})
