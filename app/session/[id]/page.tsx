import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { startOfWeekISO } from '@/lib/utils'
import SessionPlayer from './SessionPlayer'

interface Props { params: Promise<{ id: string }> }

export default async function SessionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Free-tier quota counts sessions since the start of the current week
  // (Monday) — matching the "resets Monday" copy shown to users.
  const weekStart = startOfWeekISO()

  const [{ data: plan }, { data: profile }, { count: sessionsThisWeek }, { data: partialRecords }] = await Promise.all([
    supabase.from('session_plans').select(`
      *,
      exercises:session_plan_exercises(
        order_index, reps_override, rest_after_seconds, exercise_id,
        exercise:exercises(*)
      )
    `).eq('id', id).single(),

    supabase.from('user_profiles')
      .select('subscription_status, voice_coaching_enabled')
      .eq('id', user.id)
      .single(),

    supabase.from('session_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_partial', false)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStart),

    // Find any saved partial session for this plan
    supabase.from('session_records')
      .select('id, last_exercise_index, exercises_completed, total_exercises, completed_at')
      .eq('user_id', user.id)
      .eq('session_plan_id', id)
      .eq('is_partial', true)
      .order('completed_at', { ascending: false })
      .limit(1),
  ])

  if (!plan) notFound()

  if (plan.exercises) {
    plan.exercises.sort((a: any, b: any) => a.order_index - b.order_index)
  }

  const isPro = profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'
  if (plan.is_pro && !isPro) redirect('/profile#upgrade')

  const partial = partialRecords?.[0] ?? null

  // ── Server-side free-tier gate ────────────────────────────────
  // The UI hides the "Begin" button at the limit, but that alone is a soft,
  // bypassable gate. Enforce it here so a free user can't start a 4th weekly
  // session by deep-linking. Resuming an already-started (partial) session is
  // always allowed — it was already counted when it began.
  const FREE_WEEKLY_LIMIT = 3
  if (!isPro && !partial && (sessionsThisWeek ?? 0) >= FREE_WEEKLY_LIMIT) {
    redirect('/profile#upgrade')
  }

  const partialSession = partial ? {
    id: partial.id,
    lastExerciseIndex: partial.last_exercise_index ?? 0,
    exercisesCompleted: partial.exercises_completed ?? 0,
    totalExercises: partial.total_exercises ?? 0,
    savedAt: partial.completed_at ?? new Date().toISOString(),
  } : null

  return (
    <SessionPlayer
      plan={plan}
      userId={user.id}
      isPro={isPro}
      voiceCoachingEnabled={profile?.voice_coaching_enabled ?? true}
      sessionsThisWeek={sessionsThisWeek ?? 0}
      partialSession={partialSession}
    />
  )
}
