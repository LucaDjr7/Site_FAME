// src/scripts/seed-admin.ts
// Run: npx tsx src/scripts/seed-admin.ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Next.js stores local secrets in .env.local (not .env), so load that first.
config({ path: ['.env.local', '.env'] })

const ADMIN_EMAIL = 'luca.desjardin@dauphine.eu'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? ''

if (!ADMIN_PASSWORD) {
  console.error('Set SEED_ADMIN_PASSWORD in .env.local before running this script.')
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL in .env.local before running this script.')
  process.exit(1)
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local before running this script.')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })
  if (authError && !authError.message.includes('already been registered')) {
    console.error('Auth error:', authError.message)
    process.exit(1)
  }
  let userId = authData?.user?.id

  if (!userId) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('Could not list users to recover existing admin id:', listError.message)
      process.exit(1)
    }
    const existingUser = listData?.users?.find((u) => u.email === ADMIN_EMAIL)
    if (!existingUser) {
      console.error('Auth user reported as already registered but could not be retrieved.')
      process.exit(1)
    }
    userId = existingUser.id
  }

  // 2. Check if member profile already exists
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .single()

  if (existing) {
    console.log('Admin member profile already exists.')
    return
  }

  // 3. Insert member profile
  const { error: memberError } = await supabase.from('members').insert({
    id: userId,
    prenom: 'Luca',
    nom: 'Desjardin',
    email: ADMIN_EMAIL,
    role: 'direction',
    labo: 'paris',
    domaines: [],
    is_admin: true,
    activated_at: new Date().toISOString(),
  })

  if (memberError) {
    console.error('Member insert error:', memberError.message)
    process.exit(1)
  }

  console.log(`Admin created: ${ADMIN_EMAIL}`)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
