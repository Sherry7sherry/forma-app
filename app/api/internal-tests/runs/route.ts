import { requireInternalApiTester } from '@/lib/internalTesting/auth'
import { jsonError, parseJsonRequest } from '@/lib/internalTesting/api'
import { validateRun } from '@/lib/internalTesting/persistence'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const identity = await requireInternalApiTester(); if (identity instanceof Response) return identity
  try {
    const input = validateRun(parseJsonRequest(await request.json()))
    const { data, error } = await createAdminClient().from('internal_test_runs').insert({
      tester_id: identity.userId, source_flow: input.sourceFlow, build_version: input.buildVersion,
      profile_version: input.profileVersion, environment: input.environment,
    }).select().single()
    if (error) throw error
    return Response.json({ ok: true, run: data }, { status: 201 })
  } catch (error) { return jsonError(error) }
}
