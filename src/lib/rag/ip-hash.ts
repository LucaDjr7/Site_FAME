// src/lib/rag/ip-hash.ts
import { createHash } from 'node:crypto'
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}
