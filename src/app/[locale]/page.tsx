import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { StarField } from '@/components/globe/StarField'
import { Globe } from '@/components/globe/Globe'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  await params
  const t = await getTranslations('home')

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100dvh',
        overflow: 'hidden',
        background: [
          'radial-gradient(110% 80% at 50% 12%, rgba(181,157,135,0.32) 0%, rgba(181,157,135,0) 52%)',
          'radial-gradient(120% 110% at 50% 116%, rgba(113,120,132,0.28) 0%, rgba(113,120,132,0) 60%)',
          'radial-gradient(140% 120% at 86% 48%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%)',
          '#F9F9FA',
        ].join(', '),
      }}
    >
      {/* Star field — behind everything */}
      <StarField />

      {/* Language switcher — top right */}
      <div style={{ position: 'absolute', top: 16, right: 24, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      {/* Header */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          paddingTop: 40,
          zIndex: 1,
          animation: 'fameFade 1.1s ease both',
        }}
      >
        {/* Kicker row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 1,
              background: 'linear-gradient(90deg, rgba(181,157,135,0) 0%, #B59D87 100%)',
            }}
          />
          <span
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 12,
              letterSpacing: '0.42em',
              textTransform: 'uppercase',
              color: '#717884',
            }}
          >
            {t('tagline')}
          </span>
          <div
            style={{
              width: 42,
              height: 1,
              background: 'linear-gradient(90deg, #B59D87 0%, rgba(181,157,135,0) 100%)',
            }}
          />
        </div>

        {/* FAME wordmark */}
        <h1
          style={{
            margin: 0,
            fontFamily: '"Roboto Slab", serif',
            fontWeight: 700,
            fontSize: 'clamp(52px, 10vw, 128px)',
            letterSpacing: '0.34em',
            textIndent: '0.34em',
            background: 'linear-gradient(180deg, #2f4486, #1f2e5c)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 0.9,
            textShadow: '0 2px 30px rgba(47,68,134,0.16)',
          }}
        >
          FAME
        </h1>
      </header>

      {/* Globe stage */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          zIndex: 1,
          width: '100%',
        }}
      >
        <Globe />
      </main>

      {/* Footer */}
      <footer
        style={{
          paddingBottom: 28,
          zIndex: 1,
          animation: 'fameFade 1.4s ease both',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#717884',
            textAlign: 'center',
          }}
        >
          {t('cta')}
        </p>
      </footer>
    </div>
  )
}
