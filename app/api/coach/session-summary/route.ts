import { NextResponse } from 'next/server'

import { fallbackSummary } from '@/lib/coach/fallbacks'
import { generateCoachSummary } from '@/lib/coach/providers/openai'
import { buildSummaryInput } from '@/lib/coach/summaryInput'
import type { SessionSummary } from '@/lib/coach/types'
import { validateSummary } from '@/lib/coach/validate'
import type { Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'

type SummaryStatus = 'generated' | 'fallback' | 'unavailable'

function parseSessionRecordId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const sessionRecordId = (body as { sessionRecordId?: unknown }).sessionRecordId
  return typeof sessionRecordId === 'string' && sessionRecordId.trim() ? sessionRecordId.trim() : null
}

function serializeSummary(summary: SessionSummary): string {
  return `${summary.headline}\n\n${summary.body}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionRecordId = parseSessionRecordId(body)
  if (!sessionRecordId) return NextResponse.json({ error: 'Missing sessionRecordId' }, { status: 400 })

  const [{ data: profile }, { data: record }] = await Promise.all([
    supabase.from('user_profiles')
      .select('preferred_locale')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('session_records')
      .select('id, form_score, duration_seconds, exercises_completed, skipped_exercises, completed_at, session_plan_id')
      .eq('id', sessionRecordId)
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .maybeSingle(),
  ])

  if (!record) return NextResponse.json({ error: 'Session record not found' }, { status: 404 })

  const locale: Locale = profile?.preferred_locale === 'zh-CN' ? 'zh-CN' : 'en-US'
  const input = buildSummaryInput({
    locale,
    formScore: Number(record.form_score ?? 0),
    durationSeconds: Number(record.duration_seconds ?? 0),
    exercisesCompleted: Number(record.exercises_completed ?? 0),
    skippedExercises: Number(record.skipped_exercises ?? 0),
  })

  let summary = fallbackSummary(input)
  let status: SummaryStatus = 'fallback'

  try {
    const generated = validateSummary(input, await generateCoachSummary(input))
    if (generated) {
      summary = generated
      status = 'generated'
    }
  } catch {
    status = 'unavailable'
  }

  await supabase.from('session_records')
    .update({
      ai_feedback: serializeSummary(summary),
      coach_summary_version: 'v1',
      coach_summary_status: status,
    })
    .eq('id', record.id)
    .eq('user_id', user.id)

  return NextResponse.json({ summary, status })
}
