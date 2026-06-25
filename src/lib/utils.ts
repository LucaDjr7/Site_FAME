import type { DateBucket } from '@/types'

export function dateBucket(iso: string): DateBucket {
  const y = iso.slice(0, 4)
  return y === '2025' ? '2025' : y === '2024' ? '2024' : 'older'
}
