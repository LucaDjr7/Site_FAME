'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function ActivatePage() {
  const t = useTranslations('auth')
  const { token, locale } = useParams<{ token: string; locale: string }>()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(t('passwordMismatch')); return }
    // Refléter la règle serveur : ≥8 caractères, une majuscule, un chiffre.
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t('passwordTooWeak')); return
    }
    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) {
      let msg = ''
      try {
        const body = await res.json()
        msg = body?.error ?? ''
      } catch {
        msg = ''
      }
      setError(msg || t('activationFailed'))
      return
    }
    setDone(true)
    setTimeout(() => router.push(`/${locale}/auth/login`), 2000)
  }

  if (done) return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center text-white">
      {t('activatedSuccess')}
    </div>
  )

  return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-fame-sand p-10 rounded-xl w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-serif text-2xl text-fame-blue-dark">{t('setPasswordTitle')}</h1>
        {error && <p className="text-fame-red text-sm">{error}</p>}
        <input type="password" placeholder={t('newPasswordPlaceholder')} value={password}
          onChange={e => setPassword(e.target.value)} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <input type="password" placeholder={t('confirmPasswordPlaceholder')} value={confirm}
          onChange={e => setConfirm(e.target.value)} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <button type="submit" className="bg-fame-blue text-white rounded py-2 text-sm font-medium hover:bg-fame-blue-dark">
          {t('activateButton')}
        </button>
      </form>
    </div>
  )
}
