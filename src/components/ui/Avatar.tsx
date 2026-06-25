import Image from 'next/image'

type Props = { name: string; photoUrl?: string | null; size?: number }

const COLORS = ['#2f4486','#1e9b7e','#5768ac','#e8b149','#ff6f61','#c0473b']

function colorForName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Avatar({ name, photoUrl, size = 32 }: Props) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (photoUrl) {
    // unoptimized: photo_url is a user-supplied external URL (Supabase Storage or
    // third-party CDN); dimensions are unknown at build time and Next.js image
    // optimization requires a known origin — skip optimization to avoid 400 errors.
    return <Image src={photoUrl} alt={name} width={size} height={size} unoptimized
      className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-mono font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorForName(name) }}
      title={name}
    >
      {initials}
    </span>
  )
}
