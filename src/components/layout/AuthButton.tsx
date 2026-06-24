'use client'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { Member } from '@/types'
import { Avatar } from '@/components/ui/Avatar'

type Props = { member: Member | null; locale: string }

export function AuthButton({ member, locale }: Props) {
  const t = useTranslations('auth')
  const router = useRouter()

  async function signOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    router.refresh()
    router.push(`/${locale}`)
  }

  if (!member) {
    return (
      <button
        onClick={() => router.push(`/${locale}/auth/login`)}
        className="text-xs font-mono text-slate-200 hover:text-white px-2 py-1 rounded border border-slate-400/40 hover:border-slate-300 transition-colors"
      >
        {t('signIn')}
      </button>
    )
  }

  return (
    <button
      onClick={signOut}
      className="flex items-center gap-2 text-xs font-mono text-slate-200 hover:text-white"
      title={t('signOut')}
    >
      <Avatar name={`${member.prenom} ${member.nom}`} photoUrl={member.photo_url} size={28} />
      <span className="hidden md:inline">{member.prenom}</span>
    </button>
  )
}
