import { requireInternalApiTester } from '@/lib/internalTesting/auth'
import { jsonError, parseJsonRequest } from '@/lib/internalTesting/api'
import { validateEventBatch } from '@/lib/internalTesting/persistence'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const identity = await requireInternalApiTester(); if (identity instanceof Response) return identity
  try {
    const { attemptId } = await params; const admin = createAdminClient()
    const { data: owned, error: ownershipError } = await admin.from('internal_test_attempts').select('id, internal_test_runs!inner(tester_id)').eq('id', attemptId).eq('internal_test_runs.tester_id', identity.userId).single()
    if (ownershipError || !owned) throw ownershipError ?? { code: 'PGRST116' }
    const batch = validateEventBatch({ ...parseJsonRequest(await request.json()), attemptId })
    const elapsed = batch.events.map(event => typeof event === 'object' && event && !Array.isArray(event) ? Number((event as Record<string, unknown>).elapsedMs ?? 0) : 0)
    const { error } = await admin.from('internal_test_events').insert({ attempt_id: attemptId, sequence: batch.sequence, started_elapsed_ms: Math.min(0, ...elapsed), ended_elapsed_ms: Math.max(0, ...elapsed), payload: batch.events })
    if (error) throw error
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) { return jsonError(error) }
}
