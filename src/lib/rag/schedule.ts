import { after } from 'next/server'
import { indexSource, markSourceStale } from './index-source'
import { indexSubjectFile, deleteFileChunks, deleteSubjectFileChunks } from './index-file'
import type { RagSourceType } from '@/types'

/** Re-indexe une source APRES la reponse HTTP, sans bloquer ni faire echouer la requete. */
export function scheduleReindex(type: RagSourceType, id: string): void {
  after(async () => {
    try {
      await indexSource(type, id)
    } catch {
      try {
        await markSourceStale(type, id)
      } catch {
        /* avale : un cron de rattrapage reprendra */
      }
    }
  })
}

export function scheduleIndexFile(fileId: string): void {
  after(async () => { try { await indexSubjectFile(fileId) } catch { /* avale */ } })
}
export function scheduleDeleteFileChunks(fileId: string): void {
  after(async () => { try { await deleteFileChunks(fileId) } catch { /* avale */ } })
}
export function scheduleDeleteSubjectFiles(subjectId: string): void {
  after(async () => { try { await deleteSubjectFileChunks(subjectId) } catch { /* avale */ } })
}
