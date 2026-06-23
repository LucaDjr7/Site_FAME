type Props = { params: Promise<{ locale: string; lab: string; id: string }> }

export default async function PaperPage({ params }: Props) {
  const { id } = await params
  return <div style={{ padding: 40 }}>Paper {id}</div>
}
