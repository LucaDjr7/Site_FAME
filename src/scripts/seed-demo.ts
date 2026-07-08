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
  await supabase.from('subtasks').delete().in('id', DEMO.subtasks.map(s => s.id))
  await supabase.from('tasks').delete().in('id', DEMO.tasks.map(t => t.id))
  await supabase.from('comments').delete().in('id', DEMO.comments.map(c => c.id))
  await supabase.from('subject_relations').delete().in('id', DEMO.relations.map(r => r.id))
  await supabase.from('subjects').delete().in('id', DEMO.subjects.map(s => s.id))
  await supabase.from('publications').delete().in('id', DEMO.publications.map(p => p.id))
  await supabase.from('members').delete().in('id', DEMO.members.map(m => m.id))
  // Auth user du membre de capture
  const { data } = await supabase.auth.admin.listUsers()
  const authUser = data?.users?.find(u => u.email === DEMO_MEMBER_EMAIL)
  if (authUser) await supabase.auth.admin.deleteUser(authUser.id)
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
