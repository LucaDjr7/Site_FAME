// src/scripts/index-rag.ts
// Run: npm run index:rag
import { config } from 'dotenv'
import WebSocket from 'ws'
import { reindexAll } from '@/lib/rag/index-source'

// Next.js stores local secrets in .env.local (not .env), so load that first.
config({ path: ['.env.local', '.env'] })

// Node < 22 has no native WebSocket; supabase-js eagerly builds a Realtime client
// inside createServiceClient(). Provide a global polyfill so this CLI script works
// (the Next.js runtime already has WebSocket, so server.ts stays untouched).
;(globalThis as unknown as { WebSocket?: unknown }).WebSocket ??= WebSocket

async function main() {
  console.log('Indexation RAG : démarrage…')
  const { indexed } = await reindexAll()
  console.log(`Indexation RAG terminée : ${indexed} sources traitées.`)
}

main().catch((e) => {
  console.error('Échec indexation RAG:', e)
  process.exit(1)
})
