// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { RelationsPanel } from './RelationsPanel'
import en from '../../../messages/en.json'
import type { Subject, SubjectRelation } from '@/types'

// Minimal subject factory
function makeSubject(id: string, titre: string): Subject {
  return {
    id, titre, labo: 'paris', kicker: '', question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '', keywords: [], auteurs: [],
    difficulte: 'easy',
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false,
    i18n: {}, inherits: {}, created_at: '', updated_at: '',
  }
}

const SUBJECT_ID = 'current-subject'
const motherSubject = makeSubject('mother-1', 'The Mother Subject')
const daughterSubject = makeSubject('daughter-1', 'The Daughter Subject')
const assocSubject = makeSubject('assoc-1', 'The Associated Subject')

const relations: SubjectRelation[] = [
  // Mother relation: source=mother-1 → target=current (mother-1 is the mother)
  { id: 'rel-m', source_id: 'mother-1', target_id: SUBJECT_ID, kind: 'parent', label: '', label_i18n: {}, created_at: '' },
  // Daughter relation: source=current → target=daughter-1 (current is the mother)
  { id: 'rel-d', source_id: SUBJECT_ID, target_id: 'daughter-1', kind: 'parent', label: '', label_i18n: {}, created_at: '' },
  // Association: current ↔ assoc-1
  { id: 'rel-a', source_id: SUBJECT_ID, target_id: 'assoc-1', kind: 'assoc', label: 'common theme', label_i18n: {}, created_at: '' },
]

const relatedById = new Map<string, Subject>([
  ['mother-1', motherSubject],
  ['daughter-1', daughterSubject],
  ['assoc-1', assocSubject],
])

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe('RelationsPanel — read view', () => {
  afterEach(cleanup)

  it('renders the panel title', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.getByText(en.paper.relations.title)).toBeTruthy()
  })

  it('renders the three group labels', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    // Group labels include the count e.g. "Mothers (1)"
    expect(screen.getByText(/Mothers/i)).toBeTruthy()
    expect(screen.getByText(/Daughters/i)).toBeTruthy()
    expect(screen.getByText(/Links/i)).toBeTruthy()
  })

  it('renders the localized title of the mother subject', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.getByText('The Mother Subject')).toBeTruthy()
  })

  it('renders the daughter subject title', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.getByText('The Daughter Subject')).toBeTruthy()
  })

  it('renders the associated subject title', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.getByText('The Associated Subject')).toBeTruthy()
  })

  it('shows "none" placeholders when all groups are empty', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={[]}
        relatedById={new Map()}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    const noneLabels = screen.getAllByText(en.paper.relations.none)
    // One per group (mothers, daughters, associations)
    expect(noneLabels.length).toBe(3)
  })

  it('shows the add-link button when isMember=true', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={[]}
        relatedById={new Map()}
        subjectInherits={{}}
        isMember={true}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.getByText(new RegExp(en.paper.relations.addLink))).toBeTruthy()
  })

  it('does not show add-link or remove buttons for visitors', () => {
    wrap(
      <RelationsPanel
        subjectId={SUBJECT_ID}
        relations={relations}
        relatedById={relatedById}
        subjectInherits={{}}
        isMember={false}
        open={true}
        onToggleOpen={() => {}}
        locale="en"
        lab="paris"
        allSubjects={[]}
        onChanged={() => {}}
      />
    )
    expect(screen.queryByText(new RegExp(en.paper.relations.addLink))).toBeNull()
    // × buttons should not appear
    expect(screen.queryAllByTitle(en.paper.relations.remove).length).toBe(0)
  })
})
