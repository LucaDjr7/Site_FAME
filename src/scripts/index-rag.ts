// src/scripts/index-rag.ts
// Run: npm run index:rag
import { config } from 'dotenv'
import { reindexAll } from '@/lib/rag/index-source'

// Next.js stores local secrets in .env.local (not .env), so load that first.
config({ path: ['.env.local', '.env'] })

async function main() {
  console.log('Indexation RAG : démarrage…')
  const { indexed } = await reindexAll()
  console.log(`Indexation RAG terminée : ${indexed} sources traitées.`)
}

main().catch((e) => {
  console.error('Échec indexation RAG:', e)
  process.exit(1)
})
