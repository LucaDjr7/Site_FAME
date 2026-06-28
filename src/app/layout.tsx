import type { Metadata } from 'next'
import './globals.css'

// Fallback racine (avant résolution de la locale). La description localisée est
// fournie par les `generateMetadata` des layouts [locale] (namespace `meta`).
export const metadata: Metadata = {
  title: 'FAME',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
