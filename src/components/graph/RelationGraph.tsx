'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import type { RelationGraphNode, RelationGraphEdge, Lab, SubjectStatus, RelationKind } from '@/types'
import { NODE_STATUS_COLOR, LAB_STROKE } from './graph-shared'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

// ─── d3 mutable types ────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  titre: string
  kicker: string
  labo: Lab
  statut: SubjectStatus
  is_transversal: boolean
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  id: string
  kind: RelationKind
  label: string
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  nodes: RelationGraphNode[]
  edges: RelationGraphEdge[]
  isMember: boolean
  locale: string
}

// Nœud = mini-carte (façon vitrine), pas un point.
const CARD_W = 172
const CARD_H = 58
const HW = CARD_W / 2
const HH = CARD_H / 2
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

export function RelationGraph({ nodes, edges, isMember, locale }: Props) {
  const t = useTranslations('graph')
  const tNav = useTranslations('nav')
  const tLab = useTranslations('lab')
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)

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
  // `router` n'est pas garanti stable : on le lit via une ref pour ne pas l'inclure
  // dans les deps de l'effet d3 (sinon rebuild complet de la simulation au re-render).
  const routerRef = useRef(router)

  useEffect(() => { routerRef.current = router }, [router])
  useEffect(() => { editModeRef.current = editMode }, [editMode])
  useEffect(() => { firstNodeRef.current = firstNode }, [firstNode])

  // ─── main d3 effect ───────────────────────────────────────────────────────
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.on('.zoom', null)

    const width = svgEl.clientWidth || 900
    const height = svgEl.clientHeight || 600

    // defs: arrowhead for parent edges (tip lands exactly on the card border)
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'rg-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 9)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', EDGE_PARENT)

    // Soft drop shadow for the card nodes.
    const shadow = defs.append('filter').attr('id', 'rg-shadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%')
    shadow.append('feDropShadow').attr('dx', 0).attr('dy', 6).attr('stdDeviation', 7).attr('flood-color', 'rgba(20,40,90,0.28)')

    // root <g> for zoom/pan
    const root = svg.append('g').attr('class', 'rg-root')

    // mutable copies for d3 simulation
    const simNodes: SimNode[] = filteredNodes.map(n => ({ ...n }))
    const nodeMap = new Map<string, SimNode>(simNodes.map(n => [n.id, n]))

    const simEdges: SimEdge[] = filteredEdges.map(e => ({
      id: e.id,
      source: (nodeMap.get(e.source) ?? e.source) as string,
      target: (nodeMap.get(e.target) ?? e.target) as string,
      kind: e.kind,
      label: e.label,
    }))

    // force simulation — distances/forces scaled to the card footprint
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id(d => d.id).distance(230).strength(0.55))
      .force('charge', d3.forceManyBody<SimNode>().strength(-1100))
      .force('center', d3.forceCenter<SimNode>(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>(Math.hypot(HW, HH) + 8))

    // ─── edges — invisible wide hit line + visible thin line ────────────────
    // Hit lines go in first (underneath nodes) so node clicks take priority
    const edgeHitSel = root
      .selectAll<SVGLineElement, SimEdge>('line.rg-edge-hit')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('class', 'rg-edge-hit')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('cursor', 'pointer')

    edgeHitSel.on('click', (_event, d) => {
      if (!editModeRef.current) return
      setConfirmEdgeRef.current({
        edgeId: d.id,
        sourceId: (d.source as SimNode).id,
      })
    })

    const edgeSel = root
      .selectAll<SVGLineElement, SimEdge>('line.rg-edge')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('class', 'rg-edge')
      .attr('stroke', d => d.kind === 'parent' ? EDGE_PARENT : EDGE_ASSOC)
      .attr('stroke-width', d => d.kind === 'parent' ? 1.6 : 1.2)
      .attr('stroke-dasharray', d => d.kind === 'assoc' ? '5,4' : null)
      .attr('marker-end', d => d.kind === 'parent' ? 'url(#rg-arrow)' : null)
      .attr('pointer-events', 'none')

    // ─── node groups ──────────────────────────────────────────────────────────
    const nodeSel = root
      .selectAll<SVGGElement, SimNode>('g.rg-node')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'rg-node')
      .style('cursor', 'pointer')

    const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s

    // Transversal: gold dashed rounded-rect halo behind the card
    nodeSel.filter(d => d.is_transversal)
      .append('rect')
      .attr('x', -HW - 4).attr('y', -HH - 4)
      .attr('width', CARD_W + 8).attr('height', CARD_H + 8)
      .attr('rx', 14)
      .attr('fill', 'none')
      .attr('stroke', '#e8b149')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7)

    // Selection ring (edit-mode first-pick indicator)
    nodeSel.append('rect')
      .attr('class', 'rg-sel-ring')
      .attr('x', -HW - 3).attr('y', -HH - 3)
      .attr('width', CARD_W + 6).attr('height', CARD_H + 6)
      .attr('rx', 13)
      .attr('fill', 'none')
      .attr('stroke', '#e8b149')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0) // updated by visual effect

    // Card body
    nodeSel.append('rect')
      .attr('x', -HW).attr('y', -HH)
      .attr('width', CARD_W).attr('height', CARD_H)
      .attr('rx', 11)
      .attr('fill', '#fbf9f3')
      .attr('stroke', 'rgba(20,40,90,0.14)')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#rg-shadow)')

    // Lab accent stripe (left edge)
    nodeSel.append('rect')
      .attr('x', -HW + 5).attr('y', -HH + 9)
      .attr('width', 4).attr('height', CARD_H - 18)
      .attr('rx', 2)
      .attr('fill', d => LAB_STROKE[d.labo])

    // Status dot
    nodeSel.append('circle')
      .attr('cx', -HW + 22).attr('cy', -HH + 18)
      .attr('r', 5)
      .attr('fill', d => NODE_STATUS_COLOR[d.statut])

    // Title (serif, dark) — truncated
    nodeSel.append('text')
      .text(d => trunc(d.titre, 22))
      .attr('x', -HW + 34).attr('y', -HH + 22)
      .attr('font-size', '12px')
      .attr('font-weight', 600)
      .attr('font-family', '"Roboto Slab", Georgia, serif')
      .attr('fill', '#15203f')
      .attr('pointer-events', 'none')

    // Kicker (mono, muted, uppercase) — truncated
    nodeSel.append('text')
      .text(d => trunc(d.kicker || '', 30).toUpperCase())
      .attr('x', -HW + 16).attr('y', HH - 13)
      .attr('font-size', '8px')
      .attr('letter-spacing', '0.08em')
      .attr('font-family', '"IBM Plex Mono", monospace')
      .attr('fill', '#7e8aa8')
      .attr('pointer-events', 'none')

    // ─── simulation tick ──────────────────────────────────────────────────────
    function ticked() {
      const posLine = (sel: d3.Selection<SVGLineElement, SimEdge, SVGGElement, unknown>) => {
        sel
          .attr('x1', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(s.x ?? 0, s.y ?? 0, tg.x ?? 0, tg.y ?? 0).x })
          .attr('y1', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(s.x ?? 0, s.y ?? 0, tg.x ?? 0, tg.y ?? 0).y })
          .attr('x2', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(tg.x ?? 0, tg.y ?? 0, s.x ?? 0, s.y ?? 0).x })
          .attr('y2', d => { const s = d.source as SimNode, tg = d.target as SimNode; return rectBorderPoint(tg.x ?? 0, tg.y ?? 0, s.x ?? 0, s.y ?? 0).y })
      }
      posLine(edgeHitSel)
      posLine(edgeSel)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }
    simulation.on('tick', ticked)

    // ─── drag ─────────────────────────────────────────────────────────────────
    let isDragging = false
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        isDragging = false
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        isDragging = true
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })
    nodeSel.call(drag)

    // ─── node click: navigate (read-only) or select for linking (edit mode) ──
    nodeSel.on('click', (_event, d) => {
      if (isDragging) { isDragging = false; return }
      if (editModeRef.current) {
        const prev = firstNodeRef.current
        if (prev === null) {
          setFirstNodeRef.current(d.id)
        } else if (prev === d.id) {
          setFirstNodeRef.current(null) // deselect
        } else {
          setLinkChooserRef.current({ firstId: prev, secondId: d.id })
          setFirstNodeRef.current(null)
        }
      } else {
        routerRef.current.push(`/${locale}/${d.labo}/paper/${d.id}`)
      }
    })

    // ─── hover highlight ──────────────────────────────────────────────────────
    nodeSel
      .on('mouseenter', (_event, d) => {
        const nbrs = new Set<string>([d.id])
        simEdges.forEach(e => {
          const s = (e.source as SimNode).id
          const tg = (e.target as SimNode).id
          if (s === d.id) nbrs.add(tg)
          if (tg === d.id) nbrs.add(s)
        })
        nodeSel.attr('opacity', n => nbrs.has(n.id) ? 1 : 0.15)
        edgeSel.attr('opacity', e => {
          const s = (e.source as SimNode).id
          const tg = (e.target as SimNode).id
          return s === d.id || tg === d.id ? 1 : 0.06
        })
        edgeHitSel.attr('opacity', e => {
          const s = (e.source as SimNode).id
          const tg = (e.target as SimNode).id
          return s === d.id || tg === d.id ? 1 : 0.06
        })
      })
      .on('mouseleave', () => {
        nodeSel.attr('opacity', 1)
        edgeSel.attr('opacity', 1)
        edgeHitSel.attr('opacity', 1)
      })

    // ─── zoom / pan ───────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', event => {
        root.attr('transform', event.transform)
      })
    svg.call(zoom)

    return () => {
      simulation.stop()
      svg.on('.zoom', null)
    }
  }, [filteredNodes, filteredEdges, locale])

  // ─── visual selection ring update (no simulation restart needed) ──────────
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    d3.select(svgEl)
      .selectAll<SVGCircleElement, SimNode>('circle.rg-sel-ring')
      .attr('opacity', (d: SimNode) => (editMode && firstNode === d.id) ? 1 : 0)
  }, [firstNode, editMode])

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
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        background: '#F9F9FA',
        backgroundImage: 'radial-gradient(rgba(20,40,90,0.08) 1.3px, transparent 1.3px)',
        backgroundSize: '22px 22px',
      }}
    >

      {/* ── filter + edit panel ── */}
      <div
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
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-mono text-xs text-white px-4 py-2 rounded-lg pointer-events-none border border-fame-blue/50"
          style={{ background: 'rgba(47,68,134,0.88)', backdropFilter: 'blur(4px)' }}
        >
          {firstNode ? t('pickSecondNode') : t('editModeOn')}
        </div>
      )}

      {isEmpty ? (
        /* ── empty / filtered-empty state ── */
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-sm text-fame-text-body">{t('empty')}</p>
        </div>
      ) : (
        <>
          {/* ── full-area SVG ── */}
          <svg
            ref={svgRef}
            className="flex-1 w-full"
            style={{ display: 'block' }}
            aria-label={t('title')}
          />

          {/* ── legend overlay ── */}
          <div
            className="absolute bottom-5 left-5 flex flex-col gap-2 rounded-lg p-3 border border-fame-ecru"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 12px 30px -16px rgba(20,40,90,0.4)' }}
            aria-hidden="true"
          >
            {/* parent edge */}
            <div className="flex items-center gap-2">
              <svg width="36" height="12" aria-hidden="true">
                <line x1="0" y1="6" x2="26" y2="6" stroke="rgba(20,40,90,0.42)" strokeWidth="1.6" />
                <polyline points="20,2 26,6 20,10" fill="none" stroke="rgba(20,40,90,0.42)" strokeWidth="1.6" />
              </svg>
              <span className="font-mono text-xs text-fame-text-body">{t('legendParent')}</span>
            </div>
            {/* assoc edge */}
            <div className="flex items-center gap-2">
              <svg width="36" height="12" aria-hidden="true">
                <line x1="0" y1="6" x2="26" y2="6" stroke="rgba(20,40,90,0.28)" strokeWidth="1.2" strokeDasharray="4,3" />
              </svg>
              <span className="font-mono text-xs text-fame-text-body">{t('legendAssoc')}</span>
            </div>
          </div>
        </>
      )}

      {/* ── link-kind chooser overlay ── */}
      {linkChooser && (
        <div
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
