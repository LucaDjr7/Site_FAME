'use client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// Retour à la page précédente (historique) ; repli sur l'accueil si on a
// atterri directement sur /graph (pas d'historique interne). Même logique que
// le bouton retour de l'assistant plein écran.
export function GraphBackButton({ locale }: { locale: string }) {
  const t = useTranslations('graph')
  const router = useRouter()

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(`/${locale}`)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="font-mono text-xs text-fame-slate hover:text-fame-blue transition-colors"
    >
      {t('back')}
    </button>
  )
}
