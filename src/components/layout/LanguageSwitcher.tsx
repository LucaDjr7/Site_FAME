'use client'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  function switchTo(newLocale: string) {
    // Replace /en/ or /fr/ prefix
    const newPath = pathname.replace(/^\/(en|fr)/, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <div className="flex items-center gap-1 font-mono text-xs">
      {(['en', 'fr'] as const).map(l => (
        <button
          key={l}
          lang={l}
          onClick={() => switchTo(l)}
          aria-current={locale === l ? 'true' : undefined}
          className={`px-2 py-0.5 rounded uppercase tracking-widest transition-colors ${
            locale === l
              ? 'bg-fame-blue text-white'
              : 'text-fame-text-muted hover:text-fame-text-light'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
