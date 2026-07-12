import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { startOfWeekISO } from '@/lib/utils'
import { deriveSessionBodyPolicy, loadBodyMirrorForUser } from '@/lib/bodyMirror'
import { deriveTrainingEntitlement } from '@/lib/subscriptionEntitlement'
import SessionPlayer from './SessionPlayer'
import { appEnv } from '@/lib/env'
import { authorizeInternalIdentity } from '@/lib/internalTesting/auth'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ intro?: string; testMode?: string }>
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { intro: requestedReportId, testMode } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Free-tier quota counts sessions since the start of the current week
  // (Monday) — matching the "resets Monday" copy shown to users.
  const weekStart = startOfWeekISO()

  let partialQuery = supabase.from('session_records')
    .select('id, last_exercise_index, exercises_completed, total_exercises, completed_at, report_id, is_personalized_intro')
    .eq('user_id', user.id)
    .eq('session_plan_id', id)
    .eq('is_partial', true)
  partialQuery = requestedReportId
    ? partialQuery.eq('report_id', requestedReportId).eq('is_personalized_intro', true)
    : partialQuery.eq('is_personalized_intro', false)

  const [{ data: plan }, { data: profile }, { count: sessionsThisWeek }, { data: partialRecords }, { count: completedPersonalizedIntroSessions }, { data: ownedReport }, bodyMirrorLoad] = await Promise.all([
    supabase.from('session_plans').select(`
      *,
      exercises:session_plan_exercises(
        order_index, reps_override, rest_after_seconds, exercise_id,
        exercise:exercises(*)
      )
    `).eq('id', id).single(),

    supabase.from('user_profiles')
      .select('subscription_status, voice_coaching_enabled, trial_started_at, preferred_locale')
      .eq('id', user.id)
      .single(),

    supabase.from('session_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_partial', false)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStart),

    partialQuery.order('completed_at', { ascending: false }).limit(1),

    supabase.from('session_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_personalized_intro', true)
      .eq('is_partial', false)
      .not('completed_at', 'is', null),

    requestedReportId
      ? supabase.from('body_report_versions')
        .select('id')
        .eq('id', requestedReportId)
        .eq('user_id', user.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),

    loadBodyMirrorForUser(supabase, user.id),
  ])

  if (!plan) notFound()

  if (plan.exercises) {
    plan.exercises.sort((a: any, b: any) => a.order_index - b.order_index)
  }

  const isPro = profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'
  const partial = partialRecords?.[0] ?? null
  const isPersonalizedIntro = Boolean(requestedReportId && ownedReport && plan.name === 'Desk Reset')
  const reportId = isPersonalizedIntro ? requestedReportId! : null
  const bodyPolicy = bodyMirrorLoad.result
    ? deriveSessionBodyPolicy(bodyMirrorLoad.result)
    : 'prompt_assessment'
  const entitlement = deriveTrainingEntitlement({
    bodyPolicy,
    subscriptionStatus: profile?.subscription_status ?? 'free',
    completedPersonalizedIntroSessions: completedPersonalizedIntroSessions ?? 0,
    hasPartialPersonalizedIntro: Boolean(partial?.is_personalized_intro),
  })

  if (requestedReportId && !isPersonalizedIntro) redirect('/body-report')
  if (entitlement !== 'block_safety' && plan.is_pro && !isPro) redirect('/profile#upgrade')
  if (isPersonalizedIntro && entitlement === 'require_trial') redirect('/body-report?trial=required')

  // ── Server-side free-tier gate ────────────────────────────────
  // The UI hides the "Begin" button at the limit, but that alone is a soft,
  // bypassable gate. Enforce it here so a free user can't start a 4th weekly
  // session by deep-linking. Resuming an already-started (partial) session is
  // always allowed — it was already counted when it began.
  const FREE_WEEKLY_LIMIT = 3
  if (entitlement !== 'block_safety' && !isPersonalizedIntro && !isPro && !partial && (sessionsThisWeek ?? 0) >= FREE_WEEKLY_LIMIT) {
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
      locale={profile?.preferred_locale === 'zh-CN' ? 'zh-CN' : 'en-US'}
      sessionsThisWeek={sessionsThisWeek ?? 0}
      partialSession={partialSession}
      bodyPolicy={bodyPolicy}
      entitlement={entitlement}
      isPersonalizedIntro={isPersonalizedIntro}
      reportId={reportId}
      internalTest={testMode === '1' && !!authorizeInternalIdentity(user, appEnv.internalTesterEmails())}
    />
  )
}
