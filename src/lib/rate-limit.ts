import type { NextRequest } from 'next/server'
import { checkRateLimitDb } from '@/lib/rag/rate-limit-db'

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}

// Rate-limit persistant (table `chat_rate_limit`) partagé entre instances.
// Remplace l'ancien compteur en mémoire par-instance, inefficace en serverless
// (chaque cold-start repartait d'un Map vide → limite contournable par scaling).
// Renvoie true si la requête est autorisée, false si la limite est atteinte.
export async function checkIpRateLimit(
  req: NextRequest, name: string, limit: number, windowMs: number,
): Promise<boolean> {
  return checkRateLimitDb(`${name}:${clientIp(req)}`, limit, windowMs)
}
