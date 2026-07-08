// Upload des MP4 + chapitres vers le bucket public `guide-videos` (upsert).
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

config({ path: ['../.env.local', '../.env'] })
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
  if (!process.env[k]) { console.error(`Set ${k} in ../.env.local`); process.exit(1) }
}
// Node 20 n'expose pas de WebSocket natif : realtime-js en a besoin même si on
// n'utilise que Storage. Fournir `ws` (déjà présent en dépendance transitive)
// comme suggéré par l'erreur Supabase officielle.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const BUCKET = 'guide-videos'

async function main() {
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError

  const files: Array<[string, string]> = [
    ['out/fame-guide-fr.mp4', 'video/mp4'], ['out/fame-guide-en.mp4', 'video/mp4'],
    ['out/chapters.fr.json', 'application/json'], ['out/chapters.en.json', 'application/json'],
  ]
  // Ne pas laisser l'échec d'un fichier (ex: MP4 > limite de taille projet)
  // empêcher l'upload des chapters.json qui suivent dans la liste.
  const failures: string[] = []
  for (const [path, contentType] of files) {
    const name = path.replace('out/', '')
    const { error } = await supabase.storage.from(BUCKET).upload(name, readFileSync(path), { contentType, upsert: true })
    if (error) {
      console.error(`FAILED ${name}: ${error.message}`)
      failures.push(`${name}: ${error.message}`)
      continue
    }
    console.log(`uploaded ${name}`)
  }
  console.log(`Public base: ${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)
  if (failures.length) {
    throw new Error(`${failures.length} upload(s) failed:\n${failures.join('\n')}`)
  }
}
main().catch(err => { console.error(err); process.exit(1) })
