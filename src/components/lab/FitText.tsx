'use client'
import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// useLayoutEffect côté client, useEffect en SSR (évite l'avertissement React).
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Réduit (ou agrandit jusqu'à maxPx) la taille de police de son contenu pour
 * qu'il tienne (hauteur ET largeur) dans la boîte dimensionnée par le parent —
 * pas de troncature. Les enfants expriment leurs tailles en `em` pour scaler
 * ensemble (la boîte porte la taille de base). Re-fit sur ResizeObserver.
 */
export function FitText({
  children, maxPx, minPx = 8, style, className,
}: {
  children: ReactNode
  maxPx: number
  minPx?: number
  style?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(maxPx)

  useIso(() => {
    const box = ref.current
    if (!box) return
    const fit = () => {
      // Sans dimensions de boîte (layout pas encore prêt), on attend le RO.
      if (!box.clientHeight || !box.clientWidth) return
      let lo = minPx, hi = maxPx, best = minPx
      for (let i = 0; i < 8 && lo <= hi; i++) {
        const mid = (lo + hi) / 2
        box.style.fontSize = `${mid}px`
        const fits = box.scrollHeight <= box.clientHeight + 0.5 && box.scrollWidth <= box.clientWidth + 0.5
        if (fits) { best = mid; lo = mid + 0.5 } else { hi = mid - 0.5 }
      }
      box.style.fontSize = `${best}px`
      setPx(best)
    }
    fit()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit)
      ro.observe(box)
    }
    return () => ro?.disconnect()
  }, [children, maxPx, minPx])

  return (
    <div ref={ref} className={className} style={{ ...style, fontSize: px, overflow: 'hidden' }}>
      {children}
    </div>
  )
}
