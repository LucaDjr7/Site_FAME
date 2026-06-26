// src/lib/rag/ip-hash.ts
import { createHash } from 'node:crypto'
// Pepper server-only (ASSISTANT_IP_SALT). Lu à l'appel pour rendre vraie l'affirmation
// RGPD « empreinte salée / salted hash ». Sel vide ⇒ comportement legacy.
export function hashIp(ip: string): string {
  const salt = process.env.ASSISTANT_IP_SALT ?? ''
  return createHash('sha256').update(salt + ip).digest('hex')
}
