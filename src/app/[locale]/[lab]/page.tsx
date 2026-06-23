import { notFound } from 'next/navigation'

type Props = { params: Promise<{ locale: string; lab: string }> }

const LABS = ['paris', 'montreal']

export default async function LabPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab)) notFound()

  return (
    <div style={{ padding: 40, fontFamily: '"Roboto Slab", Georgia, serif' }}>
      <h1>Lab — {lab}</h1>
    </div>
  )
}
