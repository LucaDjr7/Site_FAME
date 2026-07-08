// Run: npm run seed:demo        → insère (idempotent, upsert par id)
//      npm run seed:demo -- --purge → supprime tout le jeu démo
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { DEMO, DEMO_MEMBER_EMAIL } from './seed-demo-data'

config({ path: ['.env.local', '.env'] })

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
  if (!process.env[k]) { console.error(`Set ${k} in .env.local`); process.exit(1) }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  }
)

async function purge() {
  // Ordre FK-safe : enfants d'abord. Les cascades gèrent le reste.
  const deletes: Array<[string, readonly string[]]> = [
    ['subtasks', DEMO.subtasks.map(s => s.id)],
    ['tasks', DEMO.tasks.map(t => t.id)],
    ['comments', DEMO.comments.map(c => c.id)],
    ['subject_relations', DEMO.relations.map(r => r.id)],
    ['subjects', DEMO.subjects.map(s => s.id)],
    ['publications', DEMO.publications.map(p => p.id)],
    ['members', DEMO.members.map(m => m.id)],
  ]
  for (const [table, ids] of deletes) {
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) { console.error(`${table}:`, error.message); process.exit(1) }
  }

  // Auth user du membre de capture — listUsers() est paginé (~50/page par défaut).
  let authUser: { id: string } | undefined
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error('listUsers:', error.message); process.exit(1) }
    authUser = data.users.find(u => u.email === DEMO_MEMBER_EMAIL)
    if (authUser || data.users.length === 0) break
  }
  if (authUser) {
    const { error } = await supabase.auth.admin.deleteUser(authUser.id)
    if (error) { console.error('deleteUser:', error.message); process.exit(1) }
  } else {
    console.log(`Auth user ${DEMO_MEMBER_EMAIL} not found (already absent).`)
  }

  console.log('Demo data purged.')
}

async function seed() {
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password) { console.error('Set SEED_DEMO_PASSWORD in .env.local'); process.exit(1) }

  // 1. Auth user pour le membre de capture (id ALIGNÉ sur le profil membre)
  const alice = DEMO.members.find(m => m.email === DEMO_MEMBER_EMAIL)!
  const { error: authError } = await supabase.auth.admin.createUser({
    id: alice.id, email: alice.email, password, email_confirm: true,
  })
  if (authError && !authError.message.includes('already been registered')) {
    console.error('Auth error:', authError.message); process.exit(1)
  }

  // 2. Upserts par id (idempotent)
  const steps: Array<[string, readonly Record<string, unknown>[]]> = [
    ['members', DEMO.members], ['subjects', DEMO.subjects],
    ['subject_relations', DEMO.relations], ['tasks', DEMO.tasks],
    ['subtasks', DEMO.subtasks], ['comments', DEMO.comments],
    ['publications', DEMO.publications],
  ]
  for (const [table, rows] of steps) {
    const { error } = await supabase.from(table).upsert(rows as Record<string, unknown>[], { onConflict: 'id' })
    if (error) { console.error(`${table}:`, error.message); process.exit(1) }
    console.log(`${table}: ${rows.length} rows`)
  }
  console.log(`Demo seeded. Capture login: ${DEMO_MEMBER_EMAIL}`)
}

const run = process.argv.includes('--purge') ? purge : seed
run().catch(err => { console.error(err); process.exit(1) })
