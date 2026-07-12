import { requireInternalApiTester } from '@/lib/internalTesting/auth'
import { jsonError, parseJsonRequest } from '@/lib/internalTesting/api'
import { validateAttempt } from '@/lib/internalTesting/persistence'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const identity = await requireInternalApiTester(); if (identity instanceof Response) return identity
  try {
    const { runId } = await params; const admin = createAdminClient()
    const { data: run, error: runError } = await admin.from('internal_test_runs').select('id').eq('id', runId).eq('tester_id', identity.userId).single()
    if (runError || !run) throw runError ?? { code: 'PGRST116' }
    const input = validateAttempt({ ...parseJsonRequest(await request.json()), runId })
    const { data, error } = await admin.from('internal_test_attempts').insert({
      run_id: runId, movement_id: input.movementId, movement_kind: input.movement.kind,
      posture_family: input.movement.postureFamily, phase: input.phase,
    }).select().single()
    if (error) throw error
    return Response.json({ ok: true, attempt: data }, { status: 201 })
  } catch (error) { return jsonError(error) }
}
