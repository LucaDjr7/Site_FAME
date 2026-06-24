import { NextResponse } from 'next/server'
import { createClient as createServerClient, createServiceClient } from './supabase/server'
import type { Member, Session, Lab } from '@/types'

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data: member } = await service
    .from('members')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user: { id: user.id, email: user.email! }, member: member ?? null }
}

export async function requireMember(): Promise<{ session: Session; member: Member }> {
  const session = await getSession()
  if (!session?.member) {
    throw new AuthError(401, 'Authentication required')
  }
  return { session, member: session.member }
}

export async function requireAdmin(): Promise<{ session: Session; member: Member }> {
  const { session, member } = await requireMember()
  if (!member.is_admin) {
    throw new AuthError(403, 'Admin access required')
  }
  return { session, member }
}

// Cloisonnement cross-lab : un membre n'agit que sur son labo ; un admin agit
// sur les deux. À appeler après requireMember() avec le `labo` de la ressource.
export function assertLabAccess(member: Member, labo: Lab): void {
  if (member.is_admin) return
  if (member.labo !== labo) {
    throw new AuthError(403, 'Cross-lab access denied')
  }
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
