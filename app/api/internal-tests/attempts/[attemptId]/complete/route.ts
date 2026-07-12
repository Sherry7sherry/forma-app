import { requireInternalApiTester } from '@/lib/internalTesting/auth'
import { jsonError, parseJsonRequest } from '@/lib/internalTesting/api'
import { validateCompletion } from '@/lib/internalTesting/persistence'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const identity = await requireInternalApiTester(); if (identity instanceof Response) return identity
  try {
    const { attemptId } = await params; const admin = createAdminClient()
    const { data: owned, error: ownershipError } = await admin.from('internal_test_attempts').select('id, internal_test_runs!inner(tester_id)').eq('id', attemptId).eq('internal_test_runs.tester_id', identity.userId).single()
    if (ownershipError || !owned) throw ownershipError ?? { code: 'PGRST116' }
    const result = validateCompletion(parseJsonRequest(await request.json()))
    const { data, error } = await admin.from('internal_test_attempts').update({ status: result.status, issue_type: result.issueType, synthetic: result.synthetic, summary: { actualCount: result.actualCount }, ended_at: new Date().toISOString() }).eq('id', attemptId).select().single()
    if (error) throw error
    return Response.json({ ok: true, attempt: data })
  } catch (error) { return jsonError(error) }
}
