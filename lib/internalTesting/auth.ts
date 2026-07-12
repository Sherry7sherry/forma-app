import 'server-only'

import { redirect } from 'next/navigation'
import { appEnv } from '../env.js'
import { createClient } from '../supabase/server.js'

interface AuthUser { id: string; email?: string | null }
export interface InternalIdentity { userId: string; email: string }

export function authorizeInternalIdentity(
  user: AuthUser | null,
  allowlist: readonly string[],
): InternalIdentity | null {
  const email = user?.email?.trim().toLowerCase()
  if (!user || !email || !allowlist.includes(email)) return null
  return { userId: user.id, email }
}

export type InternalApiAuthorization =
  | { ok: true; identity: InternalIdentity }
  | { ok: false; status: 401 | 403; code: 'unauthenticated' | 'internal_tester_required' }

export function internalApiAuthorization(
  user: AuthUser | null,
  allowlist: readonly string[],
): InternalApiAuthorization {
  if (!user) return { ok: false, status: 401, code: 'unauthenticated' }
  const identity = authorizeInternalIdentity(user, allowlist)
  return identity
    ? { ok: true, identity }
    : { ok: false, status: 403, code: 'internal_tester_required' }
}

export async function requireInternalTester(): Promise<InternalIdentity> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const identity = authorizeInternalIdentity(user, appEnv.internalTesterEmails())
  if (!identity) redirect('/home')
  return identity
}

export async function requireInternalApiTester(): Promise<InternalIdentity | Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const result = internalApiAuthorization(user, appEnv.internalTesterEmails())
  if (!result.ok) return Response.json({ error: { code: result.code } }, { status: result.status })
  return result.identity
}
