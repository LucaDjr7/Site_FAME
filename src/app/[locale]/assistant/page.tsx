import { AssistantFullPage } from '@/components/assistant/AssistantFullPage'

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <AssistantFullPage locale={locale} />
}
