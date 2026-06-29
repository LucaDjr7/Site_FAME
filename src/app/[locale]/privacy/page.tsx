import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

const CONTACT_EMAIL = 'luca.desjardin@dauphine.eu'

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'privacy' })

  const sections: { key: string; afterEmail?: boolean }[] = [
    { key: 'dataCollected' },
    { key: 'purpose' },
    { key: 'retention' },
    { key: 'rights', afterEmail: true },
    { key: 'cookies' },
    { key: 'hosting' },
  ]

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <Link
        href={`/${locale}`}
        className="font-mono inline-block mb-6 text-sm text-fame-blue hover:underline"
      >
        {t('back')}
      </Link>

      <h1 className="font-serif text-2xl font-bold text-fame-blue-dark mb-8">
        {t('title')}
      </h1>

      {sections.map(({ key, afterEmail }) => (
        <section key={key} className="mb-8">
          <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">
            {t(`${key}.h` as Parameters<typeof t>[0])}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(`${key}.p` as Parameters<typeof t>[0])}
            {afterEmail && (
              <>
                {' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-fame-blue hover:underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            )}
          </p>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">
          {t('assistant.heading')}
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{t('assistant.body')}</p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">{t('assistant.provider')}</p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">{t('assistant.retention')}</p>
      </section>
    </div>
  )
}
