'use client'

type AssistButtonProps = {
  generating: boolean
  busy: boolean
  displayPrompt: string
  showingPrompt: boolean
  labels: { generate: string; generating: string; viewPrompt: string; hidePrompt: string; copyPrompt: string }
  onGenerate: () => void
  onTogglePrompt: () => void
}

export function AssistButton({ generating, busy, displayPrompt, showingPrompt, labels, onGenerate, onTogglePrompt }: AssistButtonProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="font-mono" onClick={onGenerate} disabled={busy}
        style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: 'rgba(47,68,134,0.08)', color: '#2f4486', cursor: busy ? 'wait' : 'pointer' }}>
        {generating ? `✨ ${labels.generating}` : `✨ ${labels.generate}`}
      </button>
      <button type="button" className="font-mono" onClick={onTogglePrompt}
        style={{ fontSize: 9, background: 'none', border: 'none', color: '#6b7596', cursor: 'pointer', textDecoration: 'underline' }}>
        {showingPrompt ? labels.hidePrompt : labels.viewPrompt}
      </button>
      {showingPrompt && (
        <div style={{ flexBasis: '100%' }}>
          <pre className="font-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 9, background: '#f1efe7', border: '1px solid #e0ddd0', borderRadius: 5, padding: 8, color: '#3a4257', margin: '4px 0 0' }}>{displayPrompt}</pre>
          <button type="button" className="font-mono" onClick={() => navigator.clipboard?.writeText(displayPrompt)}
            style={{ fontSize: 9, marginTop: 3, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: '#fff', cursor: 'pointer' }}>
            {labels.copyPrompt}
          </button>
        </div>
      )}
    </div>
  )
}
