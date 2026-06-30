'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import type {
  Subject, SubjectRelation, MemberRef,
  Lab, SubjectStatus, RelationKind,
} from '@/types'
import { buildGraphData } from '@/lib/subjects/graph-data'
import { toLocale2 } from '@/lib/subjects/localized'
import { SubjectVitrine } from '@/components/lab/SubjectVitrine'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

// ─── d3 mutable types ────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  labo: Lab
  statut: SubjectStatus
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  id: string
  kind: RelationKind
  label: string
}

// ─── card footprint (deterministic) ─────────────────────────────────────────
// Le nœud EST la vraie fiche vitrine (SubjectVitrine, aspect-ratio 1 / 1.414).
const CARD_W = 220
const CARD_H = Math.round(CARD_W * 1.414) // 311
const HW = CARD_W / 2 // 110
const HH = CARD_H / 2 // 155.5
const COLLIDE = Math.hypot(HW, HH) + 18 // ≈ 209
const LINK_DIST = 400
const CHARGE = -4200

// SVG canvas (couche d'arêtes derrière les fiches). overflow visible → les lignes
// hors de ce rectangle restent dessinées.
const SVG_W = 4000
const SVG_H = 3000

// Couleurs d'arêtes adaptées au fond clair.
const EDGE_PARENT = 'rgba(20,40,90,0.42)'
const EDGE_ASSOC = 'rgba(20,40,90,0.22)'

/** Point d'intersection du bord de la carte (rect centré cx,cy) sur le segment
 *  allant vers (fromX,fromY) — pour que les arêtes/flèches s'arrêtent au bord. */
function rectBorderPoint(cx: number, cy: number, fromX: number, fromY: number): { x: number; y: number } {
  const dx = fromX - cx
  const dy = fromY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const sx = dx !== 0 ? HW / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? HH / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  subjects: Subject[]
  relations: SubjectRelation[]
  members: MemberRef[]
  isMember: boolean
  locale: string
}

export function RelationGraph({ subjects, relations, members, isMember, locale }: Props) {
  const t = useTranslations('graph')
  const tNav = useTranslations('nav')
  const tLab = useTranslations('lab')
  const router = useRouter()
  const loc2 = toLocale2(locale)

  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // map id → wrapper DOM node (positions written here on each tick)
  const nodeElsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // ─── graph data (lightweight, drives the simulation) ───────────────────────
  const { nodes, edges } = useMemo(
    () => buildGraphData(subjects, relations, loc2),
    [subjects, relations, loc2],
  )
  const subjectById = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects])

  // ─── filter state ─────────────────────────────────────────────────────────
  const [filterLabo, setFilterLabo] = useState<Lab | 'all'>('all')
  const [filterStatut, setFilterStatut] = useState<SubjectStatus | 'all'>('all')
  const [treeOnly, setTreeOnly] = useState(false)

  // ─── edit mode state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [firstNode, setFirstNode] = useState<string | null>(null)
  const [linkChooser, setLinkChooser] = useState<{ firstId: string; secondId: string } | null>(null)
  const [linkKind, setLinkKind] = useState<'parent' | 'assoc'>('assoc')
  const [linkDirection, setLinkDirection] = useState<'child' | 'mother'>('child')
  const [linkLabel, setLinkLabel] = useState('')
  const [confirmEdge, setConfirmEdge] = useState<{ edgeId: string; sourceId: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const { addToast } = useToast()

  // ─── derived: filtered nodes & edges (memoised to stabilise d3 effect deps)
  const filteredNodes = useMemo(() => nodes.filter(n => {
    if (filterLabo !== 'all' && n.labo !== filterLabo) return false
    if (filterStatut !== 'all' && n.statut !== filterStatut) return false
    return true
  }), [nodes, filterLabo, filterStatut])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const filteredEdges = useMemo(() => edges.filter(e =>
    filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target) &&
    (!treeOnly || e.kind === 'parent')
  ), [edges, filteredNodeIds, treeOnly])

  // ─── stable refs so d3 handlers see current state without stale closures ──
  const editModeRef = useRef(editMode)
  const firstNodeRef = useRef(firstNode)
  const setFirstNodeRef = useRef(setFirstNode)
  const setLinkChooserRef = useRef(setLinkChooser)
  const setConfirmEdgeRef = useRef(setConfirmEdge)
  const routerRef = useRef(router)
  const localeRef = useRef(locale)

  useEffect(() => { routerRef.current = router }, [router])
  useEffect(() => { localeRef.current = locale }, [locale])
  useEffect(() => { editModeRef.current = editMode }, [editMode])
  useEffect(() => { firstNodeRef.current = firstNode }, [firstNode])

  // ─── main d3 effect (sim + edges + drag + zoom + hover + click) ────────────
  useEffect(() => {
    const containerEl = containerRef.current
    const worldEl = worldRef.current
    const svgEl = svgRef.current
    if (!containerEl || !worldEl || !svgEl) return
    if (filteredNodes.length === 0) return

    const nodeEls = nodeElsRef.current

    const CW = containerEl.clientWidth || 900
    const CH = containerEl.clientHeight || 600

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    // defs: arrowhead for parent edges (tip lands on the card border)
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'rg-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 9)
      .attr('refY', 0)
      .attr('markerWidth', 9)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', EDGE_PARENT)

    // mutable copies for d3 simulation
    const simNodes: SimNode[] = filteredNodes.map(n => ({ id: n.id, labo: n.labo, statut: n.statut }))
    const nodeMap = new Map<string, SimNode>(simNodes.map(n => [n.id, n]))

    const simEdges: SimEdge[] = filteredEdges.map(e => ({
      id: e.id,
      source: (nodeMap.get(e.source) ?? e.source) as string,
      target: (nodeMap.get(e.target) ?? e.target) as string,
      kind: e.kind,
      label: e.label,
    }))

    // adjacency for hover dimming
    const neighbors = new Map<string, Set<string>>()
    simNodes.forEach(n => neighbors.set(n.id, new Set([n.id])))
    filteredEdges.forEach(e => {
      neighbors.get(e.source)?.add(e.target)
      neighbors.get(e.target)?.add(e.source)
    })

    // force simulation — distances/forces scaled to the card footprint
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id(d => d.id).distance(LINK_DIST).strength(0.5))
      .force('charge', d3.forceManyBody<SimNode>().strength(CHARGE))
      .force('center', d3.forceCenter<SimNode>(CW / 2, CH / 2))
      .force('collide', d3.forceCollide<SimNode>(COLLIDE))

    // ─── edges — wide transparent hit line + visible thin line ──────────────
    const edgeHitSel = svg
      .selectAll<SVGLineElement, SimEdge>('line.rg-edge-hit')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('class', 'rg-edge-hit')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14)
      .style('pointer-events', 'stroke')
      .style('cursor', 'pointer')

    edgeHitSel.on('click', (_event, d) => {
      if (!editModeRef.current) return
      setConfirmEdgeRef.current({ edgeId: d.id, sourceId: (d.source as SimNode).id })
    })

    const edgeSel = svg
      .selectAll<SVGLineElement, SimEdge>('line.rg-edge')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('class', 'rg-edge')
      .attr('stroke', d => d.kind === 'parent' ? EDGE_PARENT : EDGE_ASSOC)
      .attr('stroke-width', d => d.kind === 'parent' ? 4 : 3)
      .attr('stroke-dasharray', d => d.kind === 'assoc' ? '8,6' : null)
      .attr('marker-end', d => d.kind === 'parent' ? 'url(#rg-arrow)' : null)
      .attr('pointer-events', 'none')

    // ─── transform helpers (HTML zoom: invert to world coords) ──────────────
    let transform = d3.zoomIdentity

    // ─── simulation tick — write positions DIRECTLY to the DOM ──────────────
    function positionLines(sel: d3.Selection<SVGLineElement, SimEdge, SVGSVGElement, unknown>) {
      sel
        .attr('x1', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(s.x ?? 0, s.y ?? 0, tg.x ?? 0, tg.y ?? 0).x })
        .attr('y1', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(s.x ?? 0, s.y ?? 0, tg.x ?? 0, tg.y ?? 0).y })
        .attr('x2', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(tg.x ?? 0, tg.y ?? 0, s.x ?? 0, s.y ?? 0).x })
        .attr('y2', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(tg.x ?? 0, tg.y ?? 0, s.x ?? 0, s.y ?? 0).y })
    }
    function ticked() {
      for (const n of simNodes) {
        const el = nodeEls.get(n.id)
        if (el) el.style.transform = `translate(${(n.x ?? 0) - HW}px, ${(n.y ?? 0) - HH}px)`
      }
      positionLines(edgeHitSel)
      positionLines(edgeSel)
    }
    simulation.on('tick', ticked)
    ticked() // initial paint (phyllotaxis positions)

    // ─── drag (per node wrapper) ────────────────────────────────────────────
    let moved = false
    const drag = d3.drag<HTMLDivElement, SimNode>()
      .clickDistance(6)
      .on('start', (event, d) => {
        moved = false
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        moved = true
        const [px, py] = d3.pointer(event.sourceEvent, containerEl)
        d.fx = (px - transform.x) / transform.k
        d.fy = (py - transform.y) / transform.k
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    // ─── per-wrapper wiring: bind datum, drag, click, hover ─────────────────
    simNodes.forEach(d => {
      const el = nodeEls.get(d.id)
      if (!el) return
      const sel = d3.select<HTMLDivElement, SimNode>(el).datum(d)
      sel.call(drag)
      sel.on('click', () => {
        if (moved) { moved = false; return }
        if (editModeRef.current) {
          const prev = firstNodeRef.current
          if (prev === null) {
            setFirstNodeRef.current(d.id)
          } else if (prev === d.id) {
            setFirstNodeRef.current(null)
          } else {
            setLinkChooserRef.current({ firstId: prev, secondId: d.id })
            setFirstNodeRef.current(null)
          }
        } else {
          routerRef.current.push(`/${localeRef.current}/${d.labo}/paper/${d.id}`)
        }
      })
      sel.on('mouseenter', () => {
        const nbrs = neighbors.get(d.id) ?? new Set([d.id])
        simNodes.forEach(n => {
          const e = nodeEls.get(n.id)
          if (e) e.style.opacity = nbrs.has(n.id) ? '1' : '0.2'
        })
        edgeSel.attr('opacity', e => {
          const s = (e.source as SimNode).id, tg = (e.target as SimNode).id
          return s === d.id || tg === d.id ? 1 : 0.08
        })
      })
      sel.on('mouseleave', () => {
        simNodes.forEach(n => {
          const e = nodeEls.get(n.id)
          if (e) e.style.opacity = '1'
        })
        edgeSel.attr('opacity', 1)
      })
    })

    // ─── zoom / pan (capture layer = container; transform applied to world) ──
    const baseFilter = (event: Event & { ctrlKey?: boolean; button?: number }) =>
      (!event.ctrlKey || event.type === 'wheel') && !event.button
    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.15, 2])
      .filter((event: Event) => {
        if (!baseFilter(event as Event & { ctrlKey?: boolean; button?: number })) return false
        if (event.type === 'wheel') return true
        const tgt = event.target as Element | null
        if (tgt?.closest('[data-graph-node]')) return false
        if (tgt?.closest('[data-graph-ui]')) return false
        return true
      })
      .on('zoom', event => {
        transform = event.transform
        worldEl.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`
      })

    const containerSel = d3.select<HTMLDivElement, unknown>(containerEl)
    containerSel.call(zoom)
    // start zoomed-out, graph centred in the viewport
    const K0 = 0.5
    const initial = d3.zoomIdentity
      .translate(CW / 2 * (1 - K0), CH / 2 * (1 - K0))
      .scale(K0)
    containerSel.call(zoom.transform, initial)

    return () => {
      simulation.stop()
      containerSel.on('.zoom', null)
      simNodes.forEach(d => {
        const el = nodeEls.get(d.id)
        if (el) d3.select(el).on('.drag', null).on('click', null).on('mouseenter', null).on('mouseleave', null)
      })
    }
  }, [filteredNodes, filteredEdges])

  // ─── visual selection ring update (no simulation restart needed) ──────────
  useEffect(() => {
    const nodeEls = nodeElsRef.current
    nodeEls.forEach((el, id) => {
      const selected = editMode && firstNode === id
      el.style.boxShadow = selected ? '0 0 0 3px #e8b149, 0 18px 40px -20px rgba(20,40,90,0.5)' : ''
    })
  }, [firstNode, editMode, filteredNodes])

  // ─── create link ──────────────────────────────────────────────────────────
  const createLink = async () => {
    if (!linkChooser) return
    setSaving(true)
    const body: Record<string, unknown> = { kind: linkKind, otherId: linkChooser.secondId }
    if (linkKind === 'parent') body.direction = linkDirection
    if (linkLabel.trim()) body.label = linkLabel.trim()
    try {
      const res = await fetch(`/api/subjects/${linkChooser.firstId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        addToast(data.error === 'cycle' ? t('errCycle') : t('errDuplicate'), 'error')
        setLinkChooser(null)
      } else if (res.ok) {
        setLinkChooser(null)
        setLinkLabel('')
        router.refresh()
      } else {
        addToast(t('errDuplicate'), 'error')
        setLinkChooser(null)
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── delete link ──────────────────────────────────────────────────────────
  const deleteLink = async () => {
    if (!confirmEdge) return
    await fetch(`/api/subjects/${confirmEdge.sourceId}/relations/${confirmEdge.edgeId}`, {
      method: 'DELETE',
    })
    setConfirmEdge(null)
    router.refresh()
  }

  const isEmpty = filteredNodes.length === 0

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        background: '#F9F9FA',
        backgroundImage: 'radial-gradient(rgba(20,40,90,0.08) 1.3px, transparent 1.3px)',
        backgroundSize: '22px 22px',
        cursor: 'grab',
      }}
    >
      {/* Disable the lab-grid hover-zoom inside the graph (nodes stay put). */}
      <style>{`
        [data-graph-node] .poster { transition: none; }
        [data-graph-node] .poster:hover .poster-inner { transform: none; box-shadow: 0 18px 40px -22px rgba(20,40,90,0.5); }
      `}</style>

      {/* ── world (receives the zoom transform) ── */}
      {!isEmpty && (
        <div
          ref={worldRef}
          style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', willChange: 'transform' }}
        >
          {/* edges behind the cards */}
          <svg
            ref={svgRef}
            width={SVG_W}
            height={SVG_H}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          {/* one wrapper per node → real SubjectVitrine card */}
          {filteredNodes.map(n => {
            const subject = subjectById.get(n.id)
            if (!subject) return null
            return (
              <div
                key={n.id}
                data-graph-node={n.id}
                ref={el => { if (el) nodeElsRef.current.set(n.id, el); else nodeElsRef.current.delete(n.id) }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: CARD_W,
                  borderRadius: 6,
                  cursor: 'pointer',
                  willChange: 'transform',
                }}
              >
                <SubjectVitrine
                  subject={subject}
                  locale={loc2}
                  byId={subjectById}
                  members={members}
                  editMode={false}
                  statusLabel={tLab(`status.${subject.statut}`)}
                  doneLabel={tLab('done')}
                  ficheLabel={tLab('vitrine.ficheLabel')}
                  questionLabel={tLab('vitrine.theQuestion')}
                  readLabel={tLab('vitrine.readSubject')}
                  transversalLabel={tLab('transversalBadge')}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* ── filter + edit panel ── */}
      <div
        data-graph-ui
        className="absolute top-4 right-4 z-10 flex flex-col gap-2 rounded-lg p-3 border border-fame-ecru min-w-[190px]"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 12px 30px -16px rgba(20,40,90,0.4)' }}
      >
        {/* Lab filter */}
        <div>
          <div className="font-mono text-[10px] text-fame-slate uppercase tracking-wider mb-1">
            {t('byLab')}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'paris', 'montreal'] as const).map(l => (
              <button
                key={l}
                onClick={() => { setFilterLabo(l); setFirstNode(null) }}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  filterLabo === l
                    ? 'bg-fame-blue text-white border-fame-blue'
                    : 'border-fame-ecru text-fame-text-body hover:border-fame-blue'
                }`}
              >
                {l === 'all' ? t('all') : l === 'paris' ? tNav('labParis') : tNav('labMontreal')}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div>
          <div className="font-mono text-[10px] text-fame-slate uppercase tracking-wider mb-1">
            {t('byStatus')}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'active', 'on-hold', 'done'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatut(s); setFirstNode(null) }}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  filterStatut === s
                    ? 'bg-fame-blue text-white border-fame-blue'
                    : 'border-fame-ecru text-fame-text-body hover:border-fame-blue'
                }`}
              >
                {s === 'all' ? t('all') : tLab(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Tree only */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={treeOnly}
            onChange={e => { setTreeOnly(e.target.checked); setFirstNode(null) }}
            className="accent-fame-blue"
          />
          <span className="font-mono text-[10px] text-fame-text-body">{t('treeOnly')}</span>
        </label>

        {/* Edit mode toggle (member only) */}
        {isMember && (
          <button
            onClick={() => { setEditMode(v => !v); setFirstNode(null) }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border transition-colors mt-1 ${
              editMode
                ? 'bg-fame-blue text-white border-fame-blue'
                : 'border-fame-ecru text-fame-text-body hover:border-fame-blue'
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
            </svg>
            {editMode ? t('editModeOn') : t('editMode')}
          </button>
        )}
      </div>

      {/* ── edit mode hint banner ── */}
      {editMode && !linkChooser && (
        <div
          data-graph-ui
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-mono text-xs text-white px-4 py-2 rounded-lg pointer-events-none border border-fame-blue/50"
          style={{ background: 'rgba(47,68,134,0.88)', backdropFilter: 'blur(4px)' }}
        >
          {firstNode ? t('pickSecondNode') : t('editModeOn')}
        </div>
      )}

      {/* ── empty / filtered-empty state ── */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-sm text-fame-text-body">{t('empty')}</p>
        </div>
      )}

      {/* ── legend overlay ── */}
      {!isEmpty && (
        <div
          data-graph-ui
          className="absolute bottom-5 left-5 flex flex-col gap-2 rounded-lg p-3 border border-fame-ecru z-10"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 12px 30px -16px rgba(20,40,90,0.4)' }}
          aria-hidden="true"
        >
          {/* parent edge */}
          <div className="flex items-center gap-2">
            <svg width="36" height="12" aria-hidden="true">
              <line x1="0" y1="6" x2="24" y2="6" stroke="rgba(20,40,90,0.42)" strokeWidth="3" />
              <polyline points="19,1.5 26,6 19,10.5" fill="none" stroke="rgba(20,40,90,0.42)" strokeWidth="3" />
            </svg>
            <span className="font-mono text-xs text-fame-text-body">{t('legendParent')}</span>
          </div>
          {/* assoc edge */}
          <div className="flex items-center gap-2">
            <svg width="36" height="12" aria-hidden="true">
              <line x1="0" y1="6" x2="26" y2="6" stroke="rgba(20,40,90,0.28)" strokeWidth="2.5" strokeDasharray="5,4" />
            </svg>
            <span className="font-mono text-xs text-fame-text-body">{t('legendAssoc')}</span>
          </div>
        </div>
      )}

      {/* ── link-kind chooser overlay ── */}
      {linkChooser && (
        <div
          data-graph-ui
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(10,16,40,0.60)' }}
        >
          <div
            className="rounded-xl p-6 border border-fame-blue-mid/50 flex flex-col gap-4 w-80"
            style={{ background: 'rgba(21,32,63,0.97)', backdropFilter: 'blur(8px)' }}
          >
            <div className="font-mono text-[10px] text-fame-slate uppercase tracking-wider">
              {t('editMode')}
            </div>

            {/* kind selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setLinkKind('parent')}
                className={`flex-1 font-mono text-xs py-2 rounded border transition-colors ${
                  linkKind === 'parent'
                    ? 'bg-fame-blue text-white border-fame-blue'
                    : 'border-fame-ecru text-fame-text-body hover:border-fame-blue'
                }`}
              >
                {t('linkMotherDaughter')}
              </button>
              <button
                onClick={() => setLinkKind('assoc')}
                className={`flex-1 font-mono text-xs py-2 rounded border transition-colors ${
                  linkKind === 'assoc'
                    ? 'bg-fame-blue text-white border-fame-blue'
                    : 'border-fame-ecru text-fame-text-body hover:border-fame-blue'
                }`}
              >
                {t('linkAssoc')}
              </button>
            </div>

            {/* direction picker for parent (which is mother?) */}
            {linkKind === 'parent' && (
              <div className="flex gap-2">
                {/* direction='child' → firstId is mother, secondId is daughter */}
                <button
                  onClick={() => setLinkDirection('child')}
                  className={`flex-1 font-mono text-[10px] py-1.5 rounded border transition-colors ${
                    linkDirection === 'child'
                      ? 'bg-fame-blue/40 text-fame-text-light border-fame-blue'
                      : 'border-fame-blue-mid/40 text-fame-text-dim hover:border-fame-blue'
                  }`}
                >
                  {(nodes.find(n => n.id === linkChooser.firstId)?.titre ?? '…').slice(0, 12)}
                  {' → '}
                  {(nodes.find(n => n.id === linkChooser.secondId)?.titre ?? '…').slice(0, 12)}
                </button>
                {/* direction='mother' → secondId is mother, firstId is daughter */}
                <button
                  onClick={() => setLinkDirection('mother')}
                  className={`flex-1 font-mono text-[10px] py-1.5 rounded border transition-colors ${
                    linkDirection === 'mother'
                      ? 'bg-fame-blue/40 text-fame-text-light border-fame-blue'
                      : 'border-fame-blue-mid/40 text-fame-text-dim hover:border-fame-blue'
                  }`}
                >
                  {(nodes.find(n => n.id === linkChooser.secondId)?.titre ?? '…').slice(0, 12)}
                  {' → '}
                  {(nodes.find(n => n.id === linkChooser.firstId)?.titre ?? '…').slice(0, 12)}
                </button>
              </div>
            )}

            {/* optional label */}
            <input
              type="text"
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder={t('labelOptional')}
              className="font-mono text-xs bg-fame-navy border border-fame-blue-mid/40 rounded px-3 py-2 text-fame-text-light placeholder:text-fame-text-dim focus:outline-none focus:border-fame-blue"
            />

            {/* actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setLinkChooser(null); setLinkLabel('') }}
                className="font-mono text-xs px-3 py-1.5 rounded border border-fame-blue-mid/40 text-fame-text-muted hover:border-fame-blue transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={createLink}
                disabled={saving}
                className="font-mono text-xs px-3 py-1.5 rounded bg-fame-blue text-white hover:bg-fame-blue-dark disabled:opacity-50 transition-colors"
              >
                {saving ? '…' : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── confirm edge delete ── */}
      <ConfirmDialog
        open={confirmEdge !== null}
        message={t('deleteLink')}
        onConfirm={deleteLink}
        onCancel={() => setConfirmEdge(null)}
        danger
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
      />
    </div>
  )
}
