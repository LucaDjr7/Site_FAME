'use client'
import { FitText } from './FitText'

/**
 * Ruban d'angle (clippé par overflow:hidden du parent). `side` = coin :
 * 'left' (transversal) ou 'right' (done). Le label s'auto-fitte dans la largeur
 * fixe du ruban (jamais tronqué, jamais débordant) via FitText.
 */
export function CornerRibbon({ side, color, label }: { side: 'left' | 'right'; color: string; label: string }) {
  return (
    <div
      style={{
        position: 'absolute', top: 17, width: 132,
        left: side === 'left' ? -34 : undefined,
        right: side === 'right' ? -34 : undefined,
        transform: `rotate(${side === 'left' ? -45 : 45}deg)`,
        transformOrigin: 'center',
        background: color, boxShadow: '0 2px 6px rgba(0,5,30,0.3)',
        pointerEvents: 'none', zIndex: 4, padding: '3px 6px', textAlign: 'center',
      }}
    >
      <FitText maxPx={9} minPx={5} style={{ textAlign: 'center' }}>
        <span className="font-mono" style={{ display: 'inline-block', fontSize: '1em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap' }}>{label}</span>
      </FitText>
    </div>
  )
}
