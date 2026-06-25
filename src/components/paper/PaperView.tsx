'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PaperSheet } from './PaperSheet'
import { TasksPanel } from './TasksPanel'
import { FilesPanel } from './FilesPanel'
import { CommentsPanel } from './CommentsPanel'
import { PaperNav } from './PaperNav'
import type { Lab, Subject, MemberRef, TaskWithRelations, Comment, DropboxLink } from '@/types'
import { LAB_LABELS } from '@/lib/constants'

type Props = {
  locale: string
  lab: Lab
  subject: Subject
  navSubjects: Pick<Subject, 'id' | 'titre' | 'statut' | 'ordre'>[]
  members: MemberRef[]
  tasks: TaskWithRelations[]
  initialComments: Comment[]
  links: DropboxLink[]
  isMember: boolean
}

const GHOSTS = [
  { left: '6%', top: '14%', w: 150, h: 200, op: 0.5, anim: 'drift1 24s ease-in-out infinite alternate' },
  { left: '17%', top: '52%', w: 130, h: 176, op: 0.4, anim: 'drift2 30s ease-in-out infinite alternate' },
  { left: '78%', top: '20%', w: 140, h: 188, op: 0.45, anim: 'drift3 27s ease-in-out infinite alternate' },
  { left: '84%', top: '58%', w: 120, h: 162, op: 0.35, anim: 'drift4 33s ease-in-out infinite alternate' },
  { left: '40%', top: '8%', w: 120, h: 160, op: 0.3, anim: 'drift2 21s ease-in-out infinite alternate' },
  { left: '60%', top: '72%', w: 134, h: 180, op: 0.32, anim: 'drift1 29s ease-in-out infinite alternate' },
]

export function PaperView({
  locale, lab, subject, navSubjects, members, tasks: initialTasks, initialComments, links, isMember,
}: Props) {
  const t = useTranslations('paper')
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [panels, setPanels] = useState({ tasks: true, files: true, comments: true })
  const toggle = (k: 'tasks' | 'files' | 'comments') => setPanels(p => ({ ...p, [k]: !p[k] }))

  const tasksTotal = tasks.length
  const tasksDone = tasks.filter(tk => tk.statut === 'done').length
  const pct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0

  // Member-only: toggle a task's done state via the Task 10 PATCH route.
  const onToggleTask = useCallback(async (taskId: string, nextDone: boolean) => {
    const nextStatut = nextDone ? 'done' : 'to-do'
    setTasks(prev => prev.map(tk => (tk.id === taskId ? { ...tk, statut: nextStatut } : tk)))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: nextStatut }),
    })
    if (!res.ok) {
      // revert on failure
      setTasks(prev => prev.map(tk => (tk.id === taskId ? { ...tk, statut: nextDone ? 'to-do' : 'done' } : tk)))
    }
  }, [])

  const labName = LAB_LABELS[lab] ?? lab

  return (
    <div
      className="fame-paper-root"
      style={{
        position: 'relative',
        height: 'calc(100vh - 96px)',
        overflow: 'hidden',
        background:
          'radial-gradient(110% 80% at 50% 12%, rgba(181,157,135,0.32) 0%, rgba(181,157,135,0) 52%),' +
          'radial-gradient(120% 110% at 50% 116%, rgba(113,120,132,0.28) 0%, rgba(113,120,132,0) 60%),' +
          'radial-gradient(140% 120% at 86% 48%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), #F9F9FA',
        fontFamily: "'Roboto Slab', Georgia, serif",
      }}
    >
      {/* drift1..4 keyframes moved to globals.css under "Paper view animations". */}
      <style>{`
        .fame-scroll::-webkit-scrollbar{width:8px;height:8px;}
        .fame-scroll::-webkit-scrollbar-thumb{background:rgba(150,180,255,0.22);border-radius:8px;}
        .fame-scroll::-webkit-scrollbar-track{background:transparent;}
        .paper-scroll::-webkit-scrollbar{width:7px;}
        .paper-scroll::-webkit-scrollbar-thumb{background:rgba(20,32,63,0.18);border-radius:8px;}
      `}</style>

      {/* BACKDROP — click anywhere outside the panels returns to the lab grid */}
      <Link
        href={`/${locale}/${lab}`}
        aria-label={t('back')}
        style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'block', textDecoration: 'none', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', filter: 'blur(3px)', opacity: 0.85 }}>
          {GHOSTS.map((g, i) => (
            <div key={i} style={{
              position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h,
              background: '#fdfbf6', borderRadius: 6, opacity: g.op,
              boxShadow: '0 24px 50px -14px rgba(20,40,90,0.45)', animation: g.anim,
            }}>
              <div style={{ height: '14%', margin: '9px 9px 0', borderRadius: 3, background: 'rgba(20,32,63,0.18)' }} />
              <div style={{ margin: 9, height: '46%', borderRadius: 3, background: 'repeating-linear-gradient(135deg,#e4e2d6 0 6px,#eceadf 6px 12px)' }} />
              <div style={{ margin: '0 9px', height: '6%', borderRadius: 2, background: 'rgba(20,32,63,0.1)' }} />
            </div>
          ))}
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: '0.22em',
          color: '#5c678a', textTransform: 'uppercase', pointerEvents: 'none',
        }}>↩ {t('back')}</div>
      </Link>

      {/* TOP-LEFT: link to tasks board */}
      <Link href={`/${locale}/${lab}/tasks`} style={{
        position: 'absolute', left: 24, top: 18, zIndex: 20, display: 'flex', alignItems: 'center', gap: 9,
        textDecoration: 'none', background: 'rgba(31,46,92,0.78)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(150,180,255,0.28)', borderRadius: 9, padding: '9px 15px', color: '#eef3ff',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: '0.1em',
        boxShadow: '0 14px 34px -16px rgba(0,5,30,0.7)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8b149' }} />
        {t('tasksLink')}
      </Link>

      {/* CONTENT LAYER — gaps fall through to the backdrop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>

        {/* PROGRESS bar, floating top-center */}
        <div style={{
          position: 'absolute', left: '50%', top: 46, transform: 'translateX(-50%)',
          width: 'min(520px,46vw)', pointerEvents: 'auto', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(150,180,255,0.18)', borderRadius: 12, padding: '12px 16px',
          boxShadow: '0 18px 50px -16px rgba(0,5,30,0.7)', background: 'rgba(47,68,134,0.82)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff' }}>{t('progress')}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 500, color: '#eef3ff' }}>{pct}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: '#fbf9f3', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#5670be,#2f4486,#151e3c)', transition: 'width .35s ease', width: `${pct}%` }} />
          </div>
        </div>

        {/* CENTRAL PAPER */}
        <PaperSheet subject={subject} members={members} labName={labName} locale={locale} />

        {/* LEFT: linked tasks */}
        <TasksPanel
          tasks={tasks} isMember={isMember}
          open={panels.tasks} onToggleOpen={() => toggle('tasks')}
          doneCount={tasksDone} total={tasksTotal} onToggleTask={onToggleTask}
        />

        {/* RIGHT COLUMN: files + comments (stacked, scrollable) */}
        <div className="fame-scroll" style={{
          position: 'absolute', right: 14, top: 118, bottom: 124, width: 240,
          display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'auto',
          overflowY: 'auto', overflowX: 'hidden',
        }}>
          <FilesPanel links={links} open={panels.files} onToggleOpen={() => toggle('files')} />
          <CommentsPanel
            subjectId={subject.id} isMember={isMember} initialComments={initialComments}
            open={panels.comments} onToggleOpen={() => toggle('comments')}
          />
        </div>

        {/* BOTTOM thumbnail nav */}
        <PaperNav subjects={navSubjects} currentId={subject.id} lab={lab} locale={locale} />
      </div>
    </div>
  )
}
