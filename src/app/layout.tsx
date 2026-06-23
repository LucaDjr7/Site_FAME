import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FAME',
  description: 'Financial and Monetary Economics research lab',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
