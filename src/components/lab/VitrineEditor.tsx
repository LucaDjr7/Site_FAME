'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Subject, MemberRef, Lab, SubjectStatus, Difficulty } from '@/types'
import { buildFieldPrompt, type AssistField, type FieldDraft } from '@/lib/subjects/field-prompts'
import { DOMAIN_OPTIONS } from '@/lib/subjects/domains'
import { useToast } from '@/components/ui/Toast'

// ─── AssistButton ──────────────────────────────────────────────────────────────
// Extracted at module scope to satisfy react-hooks/static-components.

type AssistLabels = {
  generate: string
  generating: string
  viewPrompt: string
  hidePrompt: string
  copyPrompt: string
}

type AssistButtonProps = {
  field: AssistField
  promptField: AssistField | null
  genField: AssistField | null
  draft: FieldDraft
  locale: 'en' | 'fr'
  onGenerate: (field: AssistField) => void
  onTogglePrompt: (field: AssistField) => void
  labels: AssistLabels
}

function AssistButton({
  field, promptField, genField, draft, locale,
  onGenerate, onTogglePrompt, labels,
}: AssistButtonProps) {
  const showing = promptField === field
  const prompt = buildFieldPrompt(field, draft, locale).displayPrompt
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
      <button
        type="button"
        className="font-mono"
        onClick={() => onGenerate(field)}
        disabled={genField !== null}
        style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 5,
          border: '1px solid rgba(20,40,90,0.2)', background: 'rgba(47,68,134,0.08)',
          color: '#2f4486', cursor: genField ? 'wait' : 'pointer',
        }}
      >
        {genField === field ? `✨ ${labels.generating}` : `✨ ${labels.generate}`}
      </button>
      <button
        type="button"
        className="font-mono"
        onClick={() => onTogglePrompt(field)}
        style={{ fontSize: 9, background: 'none', border: 'none', color: '#6b7596', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {showing ? labels.hidePrompt : labels.viewPrompt}
      </button>
      {showing && (
        <div style={{ flexBasis: '100%' }}>
          <pre
            className="font-mono"
            style={{
              whiteSpace: 'pre-wrap', fontSize: 9, background: '#f1efe7',
              border: '1px solid #e0ddd0', borderRadius: 5, padding: 8,
              color: '#3a4257', margin: '4px 0 0',
            }}
          >{prompt}</pre>
          <button
            type="button"
            className="font-mono"
            onClick={() => navigator.clipboard?.writeText(prompt)}
            style={{
              fontSize: 9, marginTop: 3, padding: '2px 7px', borderRadius: 5,
              border: '1px solid rgba(20,40,90,0.2)', background: '#fff', cursor: 'pointer',
            }}
          >
            {labels.copyPrompt}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── VitrineEditor ─────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  lab: Lab
  members: MemberRef[]
  subject: Subject | null
  locale: 'en' | 'fr'
  onClose: () => void
  onSaved: (subject: Subject, isNew: boolean) => void
}

const STATUSES: SubjectStatus[] = ['active', 'on-hold', 'done']
const DIFFS: Difficulty[] = ['easy', 'intermediate', 'advanced']

export function VitrineEditor({ open, lab, members, subject, locale, onClose, onSaved }: Props) {
  const t = useTranslations('lab')
  const tStatus = useTranslations('lab.status')
  const tDiff = useTranslations('lab.difficulty')
  const { addToast } = useToast()
  const isNew = !subject

  const [f, setF] = useState(() => ({
    question: subject?.question ?? '',
    titre: subject?.titre ?? '',
    kicker: subject?.kicker ?? '',
    accroche: subject?.accroche ?? '',
    periode: subject?.periode ?? '',
    statut: (subject?.statut ?? 'active') as SubjectStatus,
    difficulte: (subject?.difficulte ?? 'intermediate') as Difficulty,
    responsable: subject?.auteurs[0] ?? '',
    keywords: subject?.keywords.join(', ') ?? '',
    context: subject?.context ?? '',
    method: subject?.method ?? '',
    results: subject?.results ?? '',
    dimMethod: subject?.dimensions.method ?? '',
    dimData: subject?.dimensions.data ?? '',
    dimTheory: subject?.dimensions.theory ?? '',
    dimWriting: subject?.dimensions.writing ?? '',
    isTransversal: subject?.is_transversal ?? false,
    confidentiel: subject?.confidentiel ?? false,
  }))
  type Form = typeof f
  function set<K extends keyof Form>(k: K, v: Form[K]) { setF(prev => ({ ...prev, [k]: v })) }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [genField, setGenField] = useState<AssistField | null>(null)
  const [promptField, setPromptField] = useState<AssistField | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function currentDraft(): FieldDraft {
    return {
      labo: lab,
      question: f.question, titre: f.titre, kicker: f.kicker, accroche: f.accroche,
      context: f.context, method: f.method, results: f.results,
      keywords: f.keywords.split(',').map(s => s.trim()).filter(Boolean),
    }
  }

  function applyField(field: AssistField, text: string) {
    const map: Record<AssistField, keyof Form> = {
      question: 'question', titre: 'titre', accroche: 'accroche', kicker: 'kicker',
      keywords: 'keywords',
      context: 'context', method: 'method', results: 'results',
      'dimensions.method': 'dimMethod', 'dimensions.data': 'dimData',
      'dimensions.theory': 'dimTheory', 'dimensions.writing': 'dimWriting',
    }
    set(map[field], text as never)
  }

  async function generate(field: AssistField) {
    setGenField(field)
    try {
      const res = await fetch('/api/subjects/assist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, draft: currentDraft(), locale }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { text?: string }
      if (data.text) applyField(field, data.text)
    } catch {
      addToast(t('editor.genError'), 'error')
    } finally {
      setGenField(null)
    }
  }

  function togglePrompt(field: AssistField) {
    setPromptField(prev => (prev === field ? null : field))
  }

  async function save() {
    if (!f.titre.trim()) { setError(t('editor.errorRequired')); return }
    setError(''); setSaving(true)
    const payload = {
      labo: lab,
      question: f.question.trim(), titre: f.titre.trim(), kicker: f.kicker.trim(),
      accroche: f.accroche.trim(), periode: f.periode.trim(),
      statut: f.statut, difficulte: f.difficulte,
      auteurs: f.responsable ? [f.responsable] : [],
      keywords: f.keywords.split(',').map(s => s.trim()).filter(Boolean),
      context: f.context.trim(), method: f.method.trim(), results: f.results.trim(),
      dimensions: {
        method: f.dimMethod.trim(), data: f.dimData.trim(),
        theory: f.dimTheory.trim(), writing: f.dimWriting.trim(),
      },
      is_transversal: f.isTransversal, confidentiel: f.confidentiel,
    }
    try {
      const res = await fetch(isNew ? '/api/subjects' : `/api/subjects/${subject!.id}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setError((e as { error?: string }).error ?? t('error.server')); return
      }
      const saved = (await res.json()) as Subject
      onSaved(saved, isNew)
    } catch {
      setError(t('error.network'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#9a9485', display: 'block', marginBottom: 3,
  }
  const inputBase: React.CSSProperties = {
    width: '100%', background: 'transparent', border: 'none',
    borderBottom: '1px dashed rgba(20,40,90,0.25)', outline: 'none',
    padding: '2px 0', color: '#16263f',
  }
  const detailInput: React.CSSProperties = {
    width: '100%', background: '#fff', border: '1px solid rgba(20,40,90,0.18)',
    borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#2a3457',
    outline: 'none', resize: 'vertical',
  }

  // Lookup maps avoid dynamic template-literal keys (next-intl strict typing).
  const fContextLabel: Record<'context' | 'method' | 'results', string> = {
    context: t('editor.fContext'),
    method: t('editor.fMethod'),
    results: t('editor.fResults'),
  }
  const dimLabelMap: Record<'dimMethod' | 'dimData' | 'dimTheory' | 'dimWriting', string> = {
    dimMethod: t('editor.dimMethod'),
    dimData: t('editor.dimData'),
    dimTheory: t('editor.dimTheory'),
    dimWriting: t('editor.dimWriting'),
  }
  const assistLabels: AssistLabels = {
    generate: t('editor.generate'),
    generating: t('editor.generating'),
    viewPrompt: t('editor.viewPrompt'),
    hidePrompt: t('editor.hidePrompt'),
    copyPrompt: t('editor.copyPrompt'),
  }

  const draft = currentDraft()
  const domainOptions = DOMAIN_OPTIONS[locale]
  const kickerOptions = f.kicker && !domainOptions.includes(f.kicker)
    ? [f.kicker, ...domainOptions]
    : domainOptions

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? t('editor.createTitle') : t('editor.editTitle')}
        className="bg-fame-sand rounded-xl shadow-2xl w-full mx-4 my-8"
        style={{ maxWidth: 640, animation: 'modalIn 0.15s ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-fame-ecru">
          <h2 className="font-serif text-lg text-fame-blue-dark">
            {isNew ? t('editor.createTitle') : t('editor.editTitle')}
          </h2>
          <button onClick={onClose} aria-label={t('editor.cancel')} className="text-xl leading-none text-fame-text-muted">
            ×
          </button>
        </div>

        <div className="p-6">
          {/* ── Editable poster: light top ── */}
          <div style={{ background: '#faf9f5', borderRadius: 8, padding: 18, boxShadow: '0 4px 18px rgba(20,38,63,.1)' }}>
            <div>
              <label htmlFor="ve-kicker" className="font-mono" style={labelStyle}>{t('editor.fKicker')}</label>
              <select
                id="ve-kicker"
                className="font-mono"
                value={f.kicker}
                onChange={e => set('kicker', e.target.value)}
                style={{ ...inputBase, fontSize: 12, letterSpacing: '0.12em', color: '#3a5a8a', textTransform: 'uppercase' }}
              >
                <option value="">{t('editor.domainPlaceholder')}</option>
                {kickerOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="ve-periode" className="font-mono" style={labelStyle}>{t('editor.fPeriode')}</label>
                <input
                  id="ve-periode"
                  className="font-mono"
                  value={f.periode}
                  onChange={e => set('periode', e.target.value)}
                  placeholder={t('editor.phPeriode')}
                  style={{ ...inputBase, fontSize: 11 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="ve-statut" className="font-mono" style={labelStyle}>{t('editor.fStatus')}</label>
                <select
                  id="ve-statut"
                  className="font-mono"
                  value={f.statut}
                  onChange={e => set('statut', e.target.value as SubjectStatus)}
                  style={{ ...inputBase, fontSize: 11 }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{tStatus(s)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label htmlFor="ve-question" className="font-mono" style={labelStyle}>{t('editor.fQuestion')}</label>
              <textarea
                id="ve-question"
                className="font-serif"
                value={f.question}
                onChange={e => set('question', e.target.value)}
                rows={2}
                placeholder={t('editor.phQuestion')}
                style={{ ...inputBase, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.02em', resize: 'vertical' }}
              />
              <AssistButton field="question" promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label htmlFor="ve-titre" className="font-mono" style={labelStyle}>{t('editor.fTitre')} *</label>
              <input
                id="ve-titre"
                className="font-serif"
                value={f.titre}
                onChange={e => set('titre', e.target.value)}
                placeholder={t('editor.phTitre')}
                style={{ ...inputBase, fontStyle: 'italic', fontSize: 16, color: '#6a7589' }}
              />
              <AssistButton field="titre" promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
            </div>
          </div>

          {/* ── Editable poster: navy bottom ── */}
          <div style={{ background: '#15203f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <div>
              <label htmlFor="ve-accroche" className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fAccroche')}</label>
              <textarea
                id="ve-accroche"
                className="font-serif"
                value={f.accroche}
                onChange={e => set('accroche', e.target.value)}
                rows={2}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none',
                  fontStyle: 'italic', fontSize: 18, lineHeight: 1.4, color: '#cdd8ea', resize: 'vertical',
                }}
              />
              <AssistButton field="accroche" promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label htmlFor="ve-keywords" className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fKeywords')}</label>
              <input
                id="ve-keywords"
                className="font-mono"
                value={f.keywords}
                onChange={e => set('keywords', e.target.value)}
                placeholder={t('editor.phKeywords')}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none',
                  fontSize: 12, color: '#7fa3d4', letterSpacing: '0.04em',
                }}
              />
              <AssistButton field="keywords" promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label htmlFor="ve-responsable" className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fResponsable')}</label>
              <select
                id="ve-responsable"
                className="font-mono"
                value={f.responsable}
                onChange={e => set('responsable', e.target.value)}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none',
                  fontSize: 12, color: '#e7ecf4',
                }}
              >
                <option value="" style={{ color: '#000' }}>{t('editor.none')}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id} style={{ color: '#000' }}>
                    {m.prenom} {m.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Always-visible metadata: difficulty + flags ── */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="ve-difficulte" className="font-mono" style={labelStyle}>{t('editor.fDifficulty')}</label>
              <select
                id="ve-difficulte"
                className="font-mono"
                value={f.difficulte}
                onChange={e => set('difficulte', e.target.value as Difficulty)}
                style={detailInput}
              >
                {DIFFS.map(d => <option key={d} value={d}>{tDiff(d)}</option>)}
              </select>
            </div>
            <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#2a3457', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.isTransversal} onChange={e => set('isTransversal', e.target.checked)} />
              {t('editor.transversal')}
            </label>
            <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#2a3457', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.confidentiel} onChange={e => set('confidentiel', e.target.checked)} />
              {t('editor.confidentiel')}
            </label>
          </div>

          {/* ── Full details (collapsible) ── */}
          <button
            type="button"
            className="font-mono"
            onClick={() => setDetailsOpen(v => !v)}
            style={{
              marginTop: 16, width: '100%', textAlign: 'left', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: '#5a6486',
            }}
          >
            {detailsOpen ? '▾' : '▸'} {t('editor.details')}
          </button>

          {detailsOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(['context', 'method', 'results'] as const).map(key => (
                <div key={key}>
                  <label htmlFor={`ve-${key}`} className="font-mono" style={labelStyle}>{fContextLabel[key]}</label>
                  <textarea
                    id={`ve-${key}`}
                    className="font-mono"
                    value={f[key]}
                    onChange={e => set(key, e.target.value)}
                    rows={3}
                    style={detailInput}
                  />
                  <AssistButton field={key} promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
                </div>
              ))}

              {([
                ['dimMethod', 'dimensions.method'],
                ['dimData', 'dimensions.data'],
                ['dimTheory', 'dimensions.theory'],
                ['dimWriting', 'dimensions.writing'],
              ] as const).map(([stateKey, field]) => (
                <div key={stateKey}>
                  <label htmlFor={`ve-${stateKey}`} className="font-mono" style={labelStyle}>{dimLabelMap[stateKey]}</label>
                  <input
                    id={`ve-${stateKey}`}
                    className="font-mono"
                    value={f[stateKey]}
                    onChange={e => set(stateKey, e.target.value)}
                    style={detailInput}
                  />
                  <AssistButton field={field} promptField={promptField} genField={genField} draft={draft} locale={locale} onGenerate={generate} onTogglePrompt={togglePrompt} labels={assistLabels} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="font-mono text-fame-red" style={{ fontSize: 11, marginTop: 14 }}>{error}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              type="button"
              onClick={onClose}
              className="font-mono"
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(20,40,90,0.2)',
                background: '#fff', fontSize: 11, cursor: 'pointer', color: '#5a6486',
              }}
            >
              {t('editor.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="font-mono bg-fame-blue text-fame-text-light"
              style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 11,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t('editor.saving') : t('editor.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
