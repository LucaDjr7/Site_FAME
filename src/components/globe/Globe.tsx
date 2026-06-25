'use client'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { LabPin } from './LabPin'
import { useToast } from '@/components/ui/Toast'

const LABS = [
  { key: 'paris',    lon: 2.3522,   lat: 48.8566  },
  { key: 'montreal', lon: -73.5673, lat: 45.5019  },
] as const

type LabKey = typeof LABS[number]['key']

function computeSize(): number {
  if (typeof window === 'undefined') return 400
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.max(260, Math.min(w * 0.6, h * 0.58, 600))
}

export function Globe() {
  const locale = useLocale()
  const router = useRouter()
  const { addToast } = useToast()
  const t = useTranslations('nav')
  const tHome = useTranslations('home')

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const parisRef   = useRef<HTMLButtonElement>(null)
  const montRef    = useRef<HTMLButtonElement>(null)

  // mutable refs for animation state — no setState in rAF loop
  const stateRef = useRef({
    lambda: 24,
    phi: -16,
    size: 400,
    dragging: false,
    paused: false,
    rafId: 0,
    lastTime: 0,
    projection: null as d3.GeoProjection | null,
    path: null as d3.GeoPath | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    land: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    borders: null as any,
    mounted: false,
  })

  const pinRefs: Record<LabKey, React.RefObject<HTMLButtonElement | null>> = {
    paris: parisRef,
    montreal: montRef,
  }

  function handlePinClick(lab: LabKey, labelText: string) {
    addToast(tHome('enteringLab', { city: labelText }), 'success')
    setTimeout(() => router.push(`/${locale}/${lab}`), 600)
  }

  useEffect(() => {
    const state = stateRef.current
    state.mounted = true
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    // Narrow to non-null for use in closures
    const canvas: HTMLCanvasElement = canvasEl

    // ---- setup ----
    function setupCanvas() {
      const s = computeSize()
      state.size = s
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = s * dpr
      canvas.height = s * dpr
      canvas.style.width  = `${s}px`
      canvas.style.height = `${s}px`
      if (wrapperRef.current) {
        wrapperRef.current.style.width  = `${s}px`
        wrapperRef.current.style.height = `${s}px`
      }
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      state.projection = d3
        .geoOrthographic()
        .translate([s / 2, s / 2])
        .scale(s / 2 - 3)
        .rotate([state.lambda, state.phi])

      state.path = d3.geoPath(state.projection, ctx as unknown as CanvasRenderingContext2D)
    }

    function draw() {
      if (!state.projection || !state.path) return
      const ctx = canvas.getContext('2d')!
      const s = state.size

      ctx.clearRect(0, 0, s, s)

      // Ocean fill with radial gradient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sphere: any = { type: 'Sphere' }
      ctx.beginPath()
      ;(state.path as d3.GeoPath)(sphere)
      const g = ctx.createRadialGradient(
        s * 0.36, s * 0.32, s * 0.04,
        s * 0.5,  s * 0.5,  s * 0.56
      )
      g.addColorStop(0,   '#41599f')
      g.addColorStop(0.7, '#2f4486')
      g.addColorStop(1,   '#1d2b56')
      ctx.fillStyle = g
      ctx.fill()

      // Graticule
      const graticule = d3.geoGraticule10()
      ctx.beginPath()
      ;(state.path as d3.GeoPath)(graticule)
      ctx.strokeStyle = 'rgba(210,218,242,0.12)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Land
      if (state.land) {
        ctx.beginPath()
        ;(state.path as d3.GeoPath)(state.land)
        ctx.fillStyle = '#6377b0'
        ctx.fill()
      }

      // Borders
      if (state.borders) {
        ctx.beginPath()
        ;(state.path as d3.GeoPath)(state.borders)
        ctx.strokeStyle = 'rgba(22,32,72,0.5)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Globe outline
      ctx.beginPath()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(state.path as d3.GeoPath)(sphere as any)
      ctx.strokeStyle = 'rgba(31,46,92,0.45)'
      ctx.lineWidth = 1.1
      ctx.stroke()

      updatePins()
    }

    function updatePins() {
      if (!state.projection) return

      for (const lab of LABS) {
        const pinEl = pinRefs[lab.key].current
        if (!pinEl) continue

        const center: [number, number] = [-state.lambda, -state.phi]
        const coord: [number, number] = [lab.lon, lab.lat]
        const dist = d3.geoDistance(coord, center)
        const visible = dist < (Math.PI / 2 - 0.04)

        if (visible) {
          const p = state.projection(coord)
          if (p) {
            // Offset canvas to overlay div (canvas is centered in a relative parent)
            // The pin overlay div is position:absolute inset:0 over the canvas
            pinEl.style.opacity = '1'
            pinEl.style.pointerEvents = 'auto'
            pinEl.style.transform = `translate(${p[0]}px, ${p[1]}px)`
          } else {
            pinEl.style.opacity = '0'
            pinEl.style.pointerEvents = 'none'
          }
        } else {
          pinEl.style.opacity = '0'
          pinEl.style.pointerEvents = 'none'
        }
      }
    }

    // ---- animation loop ----
    function loop(ts: number) {
      if (!state.mounted) return
      const dt = Math.min((ts - (state.lastTime || ts)) / 1000, 0.1)
      state.lastTime = ts

      if (!state.dragging && !state.paused) {
        state.lambda += 5 * dt
        state.projection?.rotate([state.lambda, state.phi])
      }
      draw()
      state.rafId = requestAnimationFrame(loop)
    }

    // ---- pointer drag ----
    function onPointerDown(e: PointerEvent) {
      state.dragging = true
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    function onPointerMove(e: PointerEvent) {
      if (!state.dragging) return
      const k = 0.28
      state.lambda += e.movementX * k
      state.phi = Math.max(-89, Math.min(89, state.phi - e.movementY * k))
      state.projection?.rotate([state.lambda, state.phi])
    }
    function onPointerUp(e: PointerEvent) {
      state.dragging = false
      canvas.style.cursor = 'grab'
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* no-op */ }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    // ---- resize ----
    function onResize() {
      setupCanvas()
      draw()
    }
    window.addEventListener('resize', onResize)

    // ---- visibility: pause rAF when tab is hidden (P1) ----
    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(state.rafId)
        state.rafId = 0
      } else if (state.mounted && state.rafId === 0) {
        state.lastTime = 0
        state.rafId = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // ---- init ----
    setupCanvas()
    draw()
    // P5: respect prefers-reduced-motion — skip auto-rotation but still draw
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      state.paused = true
    }
    state.rafId = requestAnimationFrame(loop)

    // ---- load atlas ----
    const atlasUrl = '/world-110m.json'
    const cdnUrl   = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

    async function loadAtlas() {
      let world: Topology<{ countries: GeometryCollection }>
      try {
        const res = await fetch(atlasUrl)
        if (!res.ok) throw new Error('local fetch failed')
        world = await res.json() as Topology<{ countries: GeometryCollection }>
      } catch {
        const res = await fetch(cdnUrl)
        world = await res.json() as Topology<{ countries: GeometryCollection }>
      }
      if (!state.mounted) return
      state.land    = topojson.feature(world, world.objects.countries)
      state.borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b)
      draw()
    }
    loadAtlas().catch(console.error)

    return () => {
      state.mounted = false
      cancelAnimationFrame(state.rafId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [size, setSize] = useState(400)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSize(computeSize()) }, [])

  const pauseRotation  = () => { stateRef.current.paused = true  }
  const resumeRotation = () => { stateRef.current.paused = false }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: size, height: size }}>
      {/* Orbital rings — behind the globe */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-32%',
          top: '-32%',
          width: '164%',
          height: '164%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(47,68,134,0.16) 0%, rgba(47,68,134,0) 62%)',
          filter: 'blur(6px)',
        }} />
        <svg
          viewBox="0 0 200 200"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <g style={{ transformOrigin: '100px 100px', animation: 'fameSpin 64s linear infinite' }}>
            <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(47,68,134,0.26)" strokeWidth="0.5" strokeDasharray="2 9" />
          </g>
          <g style={{ transformOrigin: '100px 100px', animation: 'fameSpinRev 46s linear infinite' }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(181,157,135,0.40)" strokeWidth="0.6" strokeDasharray="1 16" />
          </g>
          <g style={{ transformOrigin: '100px 100px', animation: 'fameSpin 30s linear infinite' }}>
            <circle cx="100" cy="100" r="83" fill="none" stroke="rgba(47,68,134,0.36)" strokeWidth="0.5" strokeDasharray="34 220" strokeLinecap="round" />
            <circle cx="100" cy="100" r="83" fill="none" stroke="rgba(47,68,134,0.18)" strokeWidth="0.5" strokeDasharray="14 280" strokeDashoffset="140" strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: '100px 100px', animation: 'fameSpinRev 22s linear infinite' }}>
            <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(47,68,134,0.24)" strokeWidth="1.4" strokeDasharray="2 340" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* Canvas globe */}
      <canvas
        ref={canvasRef}
        aria-label={tHome('globeLabel')}
        style={{
          position: 'relative',
          zIndex: 2,
          borderRadius: '50%',
          cursor: 'grab',
          touchAction: 'none',
          boxShadow: '0 30px 90px -20px rgba(0,8,40,0.8), inset 0 0 60px rgba(0,5,30,0.5)',
          display: 'block',
        }}
      />

      {/* Pin overlay */}
      <div
        aria-label={tHome('globeLabel')}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <LabPin
          ref={parisRef}
          label={t('labParis')}
          onClick={() => handlePinClick('paris', t('labParis'))}
          onMouseEnter={pauseRotation}
          onMouseLeave={resumeRotation}
        />
        <LabPin
          ref={montRef}
          label={t('labMontreal')}
          onClick={() => handlePinClick('montreal', t('labMontreal'))}
          onMouseEnter={pauseRotation}
          onMouseLeave={resumeRotation}
        />
      </div>
    </div>
  )
}
