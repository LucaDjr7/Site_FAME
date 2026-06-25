import { after } from 'next/server'
import { indexSource, markSourceStale } from './index-source'
import type { RagSourceType } from '@/types'

/** Ré-indexe une source APRÈS la réponse HTTP, sans bloquer ni faire échouer la requête. */
export function scheduleReindex(type: RagSourceType, id: string): void {
  after(async () => {
    try {
      await indexSource(type, id)
    } catch {
      try {
        await markSourceStale(type, id)
      } catch {
        /* avalé : un cron de rattrapage reprendra */
      }
    }
  })
}
