'use client'
import { useTranslations } from 'next-intl'
import type { DropboxLink } from '@/types'

type Props = { links: DropboxLink[]; open: boolean; onToggleOpen: () => void }

export function FilesPanel({ links, open, onToggleOpen }: Props) {
  const t = useTranslations('paper')
  return (
    <section style={{
      flex: 'none', pointerEvents: 'auto', background: 'rgba(47,68,134,0.82)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14, boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button onClick={onToggleOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#eef3ff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4cd2a0' }} />{t('filesLinks')}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#7e95d6' }}>{links.length} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.map(l => (
            <a key={l.id} href={`https://www.dropbox.com/home${l.node_path}`} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, textDecoration: 'none',
              border: '1px solid rgba(150,180,255,0.12)', background: 'rgba(31,46,92,0.5)',
            }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(76,210,160,0.2)', color: '#74e0bb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>◷</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, color: '#eef3ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.node_name}</span>
              </span>
              <span style={{ color: '#8ea4df', fontSize: 13 }}>↗</span>
            </a>
          ))}
          {links.length === 0 && <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#7e95d6', padding: '4px 2px' }}>{t('dropboxSub')}</p>}
        </div>
      )}
    </section>
  )
}
