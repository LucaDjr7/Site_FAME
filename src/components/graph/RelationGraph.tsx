'use client'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import type { RelationGraphNode, RelationGraphEdge, Lab, SubjectStatus, RelationKind } from '@/types'
import { NODE_STATUS_COLOR, LAB_STROKE } from './graph-shared'

// ─── d3 mutable types ────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  titre: string
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
  /** Kept for Task 15 edit mode — not used in this read-only view */
  isMember: boolean
  locale: string
}

const R = 18 // node radius (px)

export function RelationGraph({ nodes, edges, locale }: Props) {
  const t = useTranslations('graph')
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return // guards empty state (SVG not mounted) and missing ref

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove() // clear previous render
    svg.on('.zoom', null)       // remove stale zoom handlers

    const width = svgEl.clientWidth || 900
    const height = svgEl.clientHeight || 600

    // ─── defs: arrowhead for parent edges ────────────────────────────────────
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'rg-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', R + 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(190,205,255,0.55)')

    // ─── root <g> for zoom/pan ───────────────────────────────────────────────
    const root = svg.append('g').attr('class', 'rg-root')

    // ─── mutable copies for d3 simulation ────────────────────────────────────
    const simNodes: SimNode[] = nodes.map(n => ({ ...n }))
    const nodeMap = new Map<string, SimNode>(simNodes.map(n => [n.id, n]))

    const simEdges: SimEdge[] = edges.map(e => ({
      id: e.id,
      // d3 forceLink resolves string IDs to node objects; supply node ref when available
      source: (nodeMap.get(e.source) ?? e.source) as string,
      target: (nodeMap.get(e.target) ?? e.target) as string,
      kind: e.kind,
      label: e.label,
    }))

    // ─── force simulation ─────────────────────────────────────────────────────
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimEdge>(simEdges)
          .id(d => d.id)
          .distance(130)
          .strength(0.8),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-380))
      .force('center', d3.forceCenter<SimNode>(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>(R + 10))

    // ─── edges ────────────────────────────────────────────────────────────────
    const edgeSel = root
      .selectAll<SVGLineElement, SimEdge>('line.rg-edge')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('class', 'rg-edge')
      .attr('stroke', d => d.kind === 'parent' ? 'rgba(190,205,255,0.55)' : 'rgba(190,205,255,0.28)')
      .attr('stroke-width', d => d.kind === 'parent' ? 1.5 : 1)
      .attr('stroke-dasharray', d => d.kind === 'assoc' ? '5,4' : null)
      .attr('marker-end', d => d.kind === 'parent' ? 'url(#rg-arrow)' : null)

    // ─── node groups ─────────────────────────────────────────────────────────
    const nodeSel = root
      .selectAll<SVGGElement, SimNode>('g.rg-node')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'rg-node')
      .style('cursor', 'pointer')

    // Halo for transversal nodes
    nodeSel.filter(d => d.is_transversal)
      .append('circle')
      .attr('r', R + 6)
      .attr('fill', 'none')
      .attr('stroke', '#e8b149')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.55)

    // Main fill circle
    nodeSel.append('circle')
      .attr('r', R)
      .attr('fill', d => NODE_STATUS_COLOR[d.statut])
      .attr('fill-opacity', 0.88)
      .attr('stroke', d => LAB_STROKE[d.labo])
      .attr('stroke-width', 2.5)

    // Title label — truncated
    nodeSel.append('text')
      .text(d => d.titre.length > 22 ? d.titre.slice(0, 20) + '…' : d.titre)
      .attr('x', R + 5)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('font-family', '"IBM Plex Mono", monospace')
      .attr('fill', 'rgba(220,230,255,0.82)')
      .attr('pointer-events', 'none')

    // ─── simulation tick ─────────────────────────────────────────────────────
    function ticked() {
      edgeSel
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }
    simulation.on('tick', ticked)

    // ─── drag ────────────────────────────────────────────────────────────────
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
        // Release fixed position so node can still move with the simulation
        d.fx = null
        d.fy = null
      })
    nodeSel.call(drag)

    // ─── click → navigate to paper ───────────────────────────────────────────
    nodeSel.on('click', (_event, d) => {
      if (isDragging) { isDragging = false; return }
      router.push(`/${locale}/${d.labo}/paper/${d.id}`)
    })

    // ─── hover highlight ─────────────────────────────────────────────────────
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
      })
      .on('mouseleave', () => {
        nodeSel.attr('opacity', 1)
        edgeSel.attr('opacity', 1)
      })

    // ─── zoom / pan ──────────────────────────────────────────────────────────
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
  }, [nodes, edges, locale, router])

  const isEmpty = nodes.length === 0

  return (
    <div className="absolute inset-0 bg-fame-navy flex flex-col overflow-hidden">
      {isEmpty ? (
        /* ── empty state ── */
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-sm text-fame-text-muted">{t('empty')}</p>
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
            className="absolute bottom-5 left-5 flex flex-col gap-2 rounded-lg p-3 border border-fame-blue-mid/40"
            style={{ background: 'rgba(24,36,76,0.75)', backdropFilter: 'blur(6px)' }}
            aria-hidden="true"
          >
            {/* parent edge */}
            <div className="flex items-center gap-2">
              <svg width="36" height="12" aria-hidden="true">
                <line
                  x1="0" y1="6" x2="26" y2="6"
                  stroke="rgba(190,205,255,0.55)"
                  strokeWidth="1.5"
                />
                <polyline
                  points="20,2 26,6 20,10"
                  fill="none"
                  stroke="rgba(190,205,255,0.55)"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="font-mono text-xs text-fame-text-muted">{t('legendParent')}</span>
            </div>
            {/* assoc edge */}
            <div className="flex items-center gap-2">
              <svg width="36" height="12" aria-hidden="true">
                <line
                  x1="0" y1="6" x2="26" y2="6"
                  stroke="rgba(190,205,255,0.28)"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                />
              </svg>
              <span className="font-mono text-xs text-fame-text-muted">{t('legendAssoc')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
