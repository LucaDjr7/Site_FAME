import type { NextRequest } from 'next/server'
import { checkRateLimitDb } from '@/lib/rag/rate-limit-db'

export function clientIp(req: NextRequest): string {
  // Sur Vercel, `x-real-ip` est posé par la plateforme avec l'IP cliente réelle et
  // écrasé à l'edge → non usurpable par le client. On le préfère au premier élément de
  // `x-forwarded-for`, que le client peut forger pour réinitialiser son bucket de
  // rate-limit (abus de coût sur l'assistant, brute-force sur sign-in). Le XFF ne sert
  // plus que de repli (dev local / autre hébergeur).
  return req.headers.get('x-real-ip')?.trim()
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
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
