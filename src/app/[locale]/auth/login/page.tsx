'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function LoginPage() {
  const t = useTranslations('auth')
  const params = useParams<{ locale: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(t('signInError'))
      return
    }
    router.push(`/${params.locale}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-fame-sand p-10 rounded-xl w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="font-serif text-2xl text-fame-blue-dark">{t('signIn')}</h1>
        {error && <p className="text-fame-red text-sm">{error}</p>}
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-fame-blue text-white rounded py-2 text-sm font-medium hover:bg-fame-blue-dark disabled:opacity-50"
        >
          {loading ? t('loading') : t('signIn')}
        </button>
      </form>
    </div>
  )
}
