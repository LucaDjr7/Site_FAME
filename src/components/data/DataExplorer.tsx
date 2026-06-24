'use client'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import type { Lab, DropboxNode, DropboxLink, Subject, Task } from '@/types'

const PAGE_BG =
  'radial-gradient(110% 80% at 24% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
  'radial-gradient(120% 110% at 80% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
  'radial-gradient(140% 120% at 90% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
  '#F9F9FA'

const SUBJECT_DOT: Record<string, string> = {
  active: '#e8b149',
  done: '#1e9b7e',
  'on-hold': '#5768ac',
}

const TASK_DOT: Record<string, string> = {
  'to-do': '#5768ac',
  'in-progress': '#e8b149',
  done: '#1e9b7e',
}

type Props = { lab: Lab }

function dropboxUrl(node: DropboxNode): string {
  return `https://www.dropbox.com/home${node.path_lower}`
}

// Build a flat lookup map of all loaded nodes
function buildNodeMap(
  rootNodes: DropboxNode[],
  childrenById: Record<string, DropboxNode[]>
): Map<string, DropboxNode> {
  const map = new Map<string, DropboxNode>()
  function walk(nodes: DropboxNode[]) {
    for (const n of nodes) {
      map.set(n.id, n)
      const children = childrenById[n.id]
      if (children) walk(children)
    }
  }
  walk(rootNodes)
  return map
}

// Flatten the visible tree into rows for rendering
type FlatRow = { node: DropboxNode; depth: number }

function flattenTree(
  nodes: DropboxNode[],
  expanded: Record<string, boolean>,
  childrenById: Record<string, DropboxNode[]>,
  depth: number = 0
): FlatRow[] {
  const rows: FlatRow[] = []
  for (const node of nodes) {
    rows.push({ node, depth })
    if (node.is_folder && expanded[node.id]) {
      const children = childrenById[node.id] ?? []
      rows.push(...flattenTree(children, expanded, childrenById, depth + 1))
    }
  }
  return rows
}

export function DataExplorer({ lab }: Props) {
  const t = useTranslations('data')
  const { addToast } = useToast()

  const [rootNodes, setRootNodes] = useState<DropboxNode[]>([])
  const [childrenById, setChildrenById] = useState<Record<string, DropboxNode[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [links, setLinks] = useState<DropboxLink[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [treeError, setTreeError] = useState<'not_configured' | 'generic' | null>(null)

  // Derived: loading children for a folder
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({})

  // Select subjects linked to a given select element (reset after adding)
  const [subjectSelectKey, setSubjectSelectKey] = useState(0)
  const [taskSelectKey, setTaskSelectKey] = useState(0)

  const labLabel = lab === 'paris' ? 'Paris' : 'Montréal'

  // Load on mount
  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)

      // Fetch tree root
      const treeRes = await fetch('/api/dropbox/tree?path=')
      if (!cancelled) {
        if (treeRes.status === 503) {
          setTreeError('not_configured')
        } else if (!treeRes.ok) {
          setTreeError('generic')
        } else {
          const data: DropboxNode[] = await treeRes.json()
          setRootNodes(data)
        }
      }

      // Fetch links
      const linksRes = await fetch(`/api/dropbox/links?lab=${lab}`)
      if (!cancelled && linksRes.ok) {
        const data: DropboxLink[] = await linksRes.json()
        setLinks(data)
      }

      // Fetch subjects
      const subjectsRes = await fetch(`/api/subjects?lab=${lab}`)
      if (!cancelled && subjectsRes.ok) {
        const data: Subject[] = await subjectsRes.json()
        setSubjects(data)
      }

      // Fetch tasks
      const tasksRes = await fetch(`/api/tasks?lab=${lab}`)
      if (!cancelled && tasksRes.ok) {
        const data: Task[] = await tasksRes.json()
        setTasks(data)
      }

      if (!cancelled) setLoading(false)
    }

    void loadAll()
    return () => { cancelled = true }
  }, [lab])

  // Expand/collapse a folder, lazy-loading children
  const toggleExpand = useCallback(async (node: DropboxNode) => {
    if (!node.is_folder) return

    const wasExpanded = expanded[node.id]

    setExpanded(prev => ({ ...prev, [node.id]: !wasExpanded }))

    // If expanding and children not yet loaded, fetch them
    if (!wasExpanded && childrenById[node.id] === undefined) {
      setLoadingChildren(prev => ({ ...prev, [node.id]: true }))
      try {
        const res = await fetch(`/api/dropbox/tree?path=${encodeURIComponent(node.path_lower)}`)
        if (res.status === 503 || !res.ok) {
          setChildrenById(prev => ({ ...prev, [node.id]: [] }))
        } else {
          const data: DropboxNode[] = await res.json()
          setChildrenById(prev => ({ ...prev, [node.id]: data }))
        }
      } catch {
        setChildrenById(prev => ({ ...prev, [node.id]: [] }))
      } finally {
        setLoadingChildren(prev => ({ ...prev, [node.id]: false }))
      }
    }
  }, [expanded, childrenById])

  // Links helpers
  function linksForNode(id: string): DropboxLink[] {
    return links.filter(l => l.node_id === id)
  }

  const linkedNodeCount = new Set(links.map(l => l.node_id)).size

  // Flat tree for rendering
  const flatRows = flattenTree(rootNodes, expanded, childrenById)

  // Node lookup map
  const nodeMap = buildNodeMap(rootNodes, childrenById)
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null

  // Get dot color for a link
  function dotColorForLink(link: DropboxLink): string {
    if (link.subject_id) {
      const subj = subjects.find(s => s.id === link.subject_id)
      return subj ? (SUBJECT_DOT[subj.statut] ?? '#5768ac') : '#5768ac'
    }
    if (link.task_id) {
      const task = tasks.find(t => t.id === link.task_id)
      return task ? (TASK_DOT[task.statut] ?? '#5768ac') : '#5768ac'
    }
    return '#5768ac'
  }

  function titleForLink(link: DropboxLink): string {
    if (link.subject_id) {
      const subj = subjects.find(s => s.id === link.subject_id)
      return subj?.titre ?? link.subject_id
    }
    if (link.task_id) {
      const task = tasks.find(t => t.id === link.task_id)
      return task?.titre ?? link.task_id
    }
    return ''
  }

  async function addLink(node: DropboxNode, opts: { subject_id?: string; task_id?: string }) {
    const res = await fetch('/api/dropbox/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: node.id,
        node_path: node.path_lower,
        node_name: node.name,
        labo: lab,
        subject_id: opts.subject_id,
        task_id: opts.task_id,
      }),
    })
    if (res.ok) {
      const newLink: DropboxLink = await res.json()
      setLinks(prev => [...prev, newLink])
      addToast(t('linkAdded'), 'success')
      // Reset select keys to clear the selects
      setSubjectSelectKey(k => k + 1)
      setTaskSelectKey(k => k + 1)
    } else {
      addToast(t('errorGeneric'), 'error')
    }
  }

  async function removeLink(id: string) {
    const res = await fetch(`/api/dropbox/links/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setLinks(prev => prev.filter(l => l.id !== id))
      addToast(t('linkRemoved'), 'info')
    } else {
      addToast(t('errorGeneric'), 'error')
    }
  }

  // Subjects/tasks not already linked to the selected node
  const selectedNodeLinks = selectedNode ? linksForNode(selectedNode.id) : []
  const linkedSubjectIds = new Set(selectedNodeLinks.filter(l => l.subject_id).map(l => l.subject_id!))
  const linkedTaskIds = new Set(selectedNodeLinks.filter(l => l.task_id).map(l => l.task_id!))

  const unlinkedSubjects = subjects.filter(s => !linkedSubjectIds.has(s.id))
  const unlinkedTasks = tasks.filter(t => !linkedTaskIds.has(t.id))

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 3rem)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Roboto Slab', Georgia, serif",
        color: '#18244c',
        background: PAGE_BG,
      }}
    >
      {/* ── Secondary toolbar ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px 14px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(20,40,90,0.1)',
        }}
      >
        {/* Left: kicker + title */}
        <div>
          <div
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#7e95d6',
              marginBottom: 3,
            }}
          >
            FAME / {labLabel}
          </div>
          <h1
            style={{
              fontFamily: "'Roboto Slab', Georgia, serif",
              fontSize: 20,
              fontWeight: 600,
              color: '#15203f',
              margin: 0,
            }}
          >
            {t('title')}
          </h1>
        </div>

        {/* Right: open root button */}
        <a
          href="https://www.dropbox.com/home"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(0,97,255,0.12)',
            border: '1px solid rgba(120,170,255,0.45)',
            color: '#1f4f9e',
            borderRadius: 9,
            padding: '8px 14px',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          {t('openRoot')}
        </a>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Tree pane ──────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '26px 30px 60px',
            minWidth: 0,
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {/* Tree header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: '#2f4486',
                  flexShrink: 0,
                }}
              >
                {t('tree')}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(20,40,90,0.12)',
                }}
              />
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  color: '#6b7596',
                  flexShrink: 0,
                }}
              >
                {linkedNodeCount} {t('linkedFolders')}
              </span>
            </div>

            {/* Tree card */}
            <div
              style={{
                background: '#fbf9f3',
                borderRadius: 11,
                boxShadow:
                  '0 16px 40px -24px rgba(0,5,30,0.4), inset 0 0 0 1px rgba(0,0,0,0.05)',
                padding: 10,
              }}
            >
              {treeError === 'not_configured' ? (
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: '#6b7596',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  {t('notConfigured')}
                </div>
              ) : treeError === 'generic' ? (
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: '#c0473b',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  {t('errorGeneric')}
                </div>
              ) : loading ? (
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: '#6b7596',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  {t('loading')}
                </div>
              ) : (
                <div>
                  {flatRows.map(({ node, depth }) => {
                    const isSelected = selectedId === node.id
                    const isExpanded = !!expanded[node.id]
                    const isLoadingChild = !!loadingChildren[node.id]
                    const nodeLinks = linksForNode(node.id)
                    const dotsToShow = nodeLinks.slice(0, 4)

                    return (
                      <div
                        key={node.id}
                        onClick={() => {
                          setSelectedId(node.id)
                          if (node.is_folder) void toggleExpand(node)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '7px 9px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(47,68,134,0.1)'
                            : 'transparent',
                        }}
                      >
                        {/* Depth spacer */}
                        <div style={{ width: depth * 18, flexShrink: 0 }} />

                        {/* Chevron */}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (node.is_folder) void toggleExpand(node)
                          }}
                          style={{
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            cursor: node.is_folder ? 'pointer' : 'default',
                            color: '#6b7596',
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: 10,
                            flexShrink: 0,
                            padding: 0,
                          }}
                        >
                          {node.is_folder
                            ? isLoadingChild
                              ? '…'
                              : isExpanded
                                ? '▾'
                                : '▸'
                            : ''}
                        </button>

                        {/* Icon */}
                        {node.is_folder ? (
                          <div
                            style={{
                              width: 16,
                              height: 12,
                              borderRadius: 3,
                              background: '#cdb184',
                              marginRight: 7,
                              marginLeft: 4,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 12,
                              height: 14,
                              borderRadius: 2,
                              background: '#fff',
                              border: '1px solid rgba(20,40,90,0.28)',
                              marginRight: 7,
                              marginLeft: 4,
                              flexShrink: 0,
                            }}
                          />
                        )}

                        {/* Name */}
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13.5,
                            color: isSelected ? '#2f4486' : '#2a3457',
                            fontWeight: node.is_folder ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {node.name}
                        </span>

                        {/* Link dots */}
                        {dotsToShow.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 3,
                              marginLeft: 6,
                              flexShrink: 0,
                            }}
                          >
                            {dotsToShow.map(link => (
                              <div
                                key={link.id}
                                title={titleForLink(link)}
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: dotColorForLink(link),
                                  flexShrink: 0,
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Open in Dropbox icon link */}
                        <a
                          href={dropboxUrl(node)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#4f8dff',
                            textDecoration: 'none',
                            fontSize: 12,
                            marginLeft: 4,
                            flexShrink: 0,
                            borderRadius: 4,
                          }}
                          title="Open in Dropbox"
                        >
                          ↗
                        </a>
                      </div>
                    )
                  })}
                  {flatRows.length === 0 && !loading && (
                    <div
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 12,
                        color: '#6b7596',
                        textAlign: 'center',
                        padding: '40px 20px',
                      }}
                    >
                      —
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Detail panel ───────────────────────────────────────────── */}
        <div
          style={{
            flex: 'none',
            width: 330,
            overflowY: 'auto',
            borderLeft: '1px solid rgba(20,40,90,0.1)',
            background: 'rgba(244,243,236,0.92)',
            padding: '24px 22px 30px',
          }}
        >
          {!selectedNode ? (
            /* Empty state */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
                gap: 12,
              }}
            >
              {/* Folder icon block */}
              <div
                style={{
                  width: 40,
                  height: 30,
                  borderRadius: 6,
                  background: 'rgba(205,177,132,0.35)',
                }}
              />
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 13.5,
                  color: '#6b7596',
                  textAlign: 'center',
                }}
              >
                {t('noSelection')}
              </span>
            </div>
          ) : (
            /* Node detail */
            <div>
              {/* Path kicker */}
              <div
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  color: '#6b7596',
                  marginBottom: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={selectedNode.path_lower}
              >
                {selectedNode.path_lower}
              </div>

              {/* Icon + name */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                {selectedNode.is_folder ? (
                  <div
                    style={{
                      width: 22,
                      height: 16,
                      borderRadius: 4,
                      background: '#cdb184',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 16,
                      height: 20,
                      borderRadius: 3,
                      background: '#fff',
                      border: '1px solid rgba(20,40,90,0.28)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#15203f',
                    margin: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedNode.name}
                </h2>
              </div>

              {/* Open in Dropbox button */}
              <a
                href={dropboxUrl(selectedNode)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  background: '#0061ff',
                  color: '#fff',
                  borderRadius: 9,
                  padding: '10px 14px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginBottom: 22,
                }}
              >
                {t('openDropbox')}
              </a>

              {/* Links section */}
              <div
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: '#2f4486',
                  marginBottom: 10,
                }}
              >
                {t('linkedTo')}
              </div>

              {/* Existing links */}
              {selectedNodeLinks.length === 0 ? (
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 12,
                    color: '#6b7596',
                    marginBottom: 18,
                  }}
                >
                  {t('noLinks')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {selectedNodeLinks.map(link => {
                    const isSubject = !!link.subject_id
                    const subj = isSubject ? subjects.find(s => s.id === link.subject_id) : null
                    const task = !isSubject ? tasks.find(t2 => t2.id === link.task_id) : null
                    const dotColor = dotColorForLink(link)
                    const itemTitle = subj?.titre ?? task?.titre ?? ''

                    return (
                      <div
                        key={link.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: '#fff',
                          border: '1px solid rgba(20,40,90,0.1)',
                          borderRadius: 9,
                          padding: '8px 10px',
                        }}
                      >
                        {/* Dot */}
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: dotColor,
                            flexShrink: 0,
                          }}
                        />
                        {/* Label */}
                        <span
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: 9,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: '#9aa3bd',
                            flexShrink: 0,
                          }}
                        >
                          {isSubject ? t('subjectLabel') : t('taskLabel')}
                        </span>
                        {/* Title */}
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: '#2a3457',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={itemTitle}
                        >
                          {itemTitle}
                        </span>
                        {/* Remove button */}
                        <button
                          onClick={() => void removeLink(link.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9aa3bd',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '0 2px',
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          title="Remove link"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Link to subject select */}
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 10,
                    color: '#6b7596',
                    marginBottom: 5,
                  }}
                >
                  {t('linkToSubject')}
                </label>
                <select
                  key={`subject-${subjectSelectKey}`}
                  defaultValue=""
                  onChange={e => {
                    const val = e.target.value
                    if (val && selectedNode) {
                      void addLink(selectedNode, { subject_id: val })
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(20,40,90,0.15)',
                    background: '#fff',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: '#2a3457',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">{t('chooseSubject')}</option>
                  {unlinkedSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.titre}</option>
                  ))}
                </select>
              </div>

              {/* Link to task select */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 10,
                    color: '#6b7596',
                    marginBottom: 5,
                  }}
                >
                  {t('linkToTask')}
                </label>
                <select
                  key={`task-${taskSelectKey}`}
                  defaultValue=""
                  onChange={e => {
                    const val = e.target.value
                    if (val && selectedNode) {
                      void addLink(selectedNode, { task_id: val })
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(20,40,90,0.15)',
                    background: '#fff',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: '#2a3457',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">{t('chooseTask')}</option>
                  {unlinkedTasks.map(task => (
                    <option key={task.id} value={task.id}>{task.titre}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
