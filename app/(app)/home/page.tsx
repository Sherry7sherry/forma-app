import { AlertTriangle, ArrowRight, Clock3, Info, RefreshCw, Sparkles } from 'lucide-react'
import Link from 'next/link'

import BodyCheckInSheet from '@/components/body-mirror/BodyCheckInSheet'
import BodyMirrorDimensions from '@/components/body-mirror/BodyMirrorDimensions'
import { UpgradeButton } from '@/components/billing/BillingButton'
import { formatSafetySignals, loadBodyMirrorForUser, type SafetySignal } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/server'
import { getDayName, getGreeting, startOfWeekISO } from '@/lib/utils'

interface SessionPlanSummary {
  id: string
  name: string
  description: string
  duration_minutes: number
  difficulty: string
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [
    { data: profile },
    bodyMirrorLoad,
    { data: quickPlan },
    { data: fullPlans },
    { data: weeklySessions },
  ] = await Promise.all([
    supabase.from('user_profiles').select('full_name, subscription_status').eq('id', userId).single(),
    loadBodyMirrorForUser(supabase, userId),
    supabase.from('session_plans')
      .select('id, name, description, duration_minutes, difficulty')
      .eq('name', 'Desk Reset')
      .maybeSingle(),
    supabase.from('session_plans')
      .select('id, name, description, duration_minutes, difficulty')
      .eq('is_pro', false)
      .gte('duration_minutes', 15)
      .order('duration_minutes', { ascending: true })
      .limit(1),
    supabase.from('session_records')
      .select('id, is_partial')
      .eq('user_id', userId)
      .gte('completed_at', startOfWeekISO()),
  ])

  const bodyMirror = bodyMirrorLoad.result
  const fullPlan = (fullPlans?.[0] ?? null) as SessionPlanSummary | null
  const completedThisWeek = weeklySessions?.filter(session => !session.is_partial).length ?? 0
  const sessionsLeft = Math.max(0, 3 - completedThisWeek)
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const isPro = profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'

  return (
    <div className="fade-up pb-6">
      <header className="px-5 pb-5 pt-14">
        <p className="mb-1 text-sm text-muted">{getGreeting()}</p>
        <h1 className="font-serif text-2xl font-medium">Welcome back, {firstName}</h1>
        <p className="mt-1 text-xs text-muted">{getDayName()}</p>
      </header>

      <section className="px-5" aria-labelledby="todays-body-heading">
        <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-b from-[#3F5F54] to-[#527368] px-5 py-5 shadow-[0_14px_36px_rgba(63,95,84,.22)]">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DCE8E1]">Personal Body Mirror</p>
              <h2 id="todays-body-heading" className="font-serif text-2xl text-cream">Today’s Body</h2>
            </div>
            {bodyMirror && (
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide
                ${bodyMirror.status === 'safety_hold' ? 'bg-rose text-white' : 'bg-white/10 text-cream'}`}>
                {statusLabel(bodyMirror.status)}
              </span>
            )}
          </div>

          {!bodyMirror ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex gap-3">
                <RefreshCw size={19} className="mt-0.5 flex-shrink-0 text-[#DCE8E1]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-cream">Body data is unavailable</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#DCE8E1]">We could not load your evidence. Your mirror has not been replaced with an empty state.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <BodyMirrorDimensions result={bodyMirror} compact />
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-4">
                <div className="flex min-w-0 items-center gap-2 text-xs text-[#DCE8E1]">
                  <Clock3 size={14} aria-hidden="true" />
                  <span className="truncate">{bodyMirror.freshness.label}</span>
                </div>
                {bodyMirror.freshness.asOf && (
                  <time className="flex-shrink-0 text-[11px] text-[#DCE8E1]" dateTime={bodyMirror.freshness.asOf}>
                    {formatEvidenceDate(bodyMirror.freshness.asOf)}
                  </time>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {bodyMirror && (
        <section className="px-5 pt-5" aria-labelledby="recommendation-heading">
          <div className={`rounded-3xl border p-5 shadow-card
            ${bodyMirror.status === 'safety_hold' ? 'border-rose/30 bg-rose/10' : 'border-border bg-white'}`}>
            <div className="mb-3 flex items-center gap-2">
              {bodyMirror.status === 'safety_hold'
                ? <AlertTriangle size={18} className="text-rose-dark" aria-hidden="true" />
                : <Sparkles size={18} className="text-sage-dark" aria-hidden="true" />}
              <p className={`text-xs font-semibold uppercase tracking-[0.14em]
                ${bodyMirror.status === 'safety_hold' ? 'text-rose-dark' : 'text-sage-dark'}`}>Today’s Plan</p>
            </div>
            <h2 id="recommendation-heading" className="font-serif text-xl">{bodyMirror.recommendation.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">{bodyMirror.recommendation.reason}</p>

            {bodyMirror.confidenceNotice === 'latest_attempt_not_applied' && (
              <div className="mt-4 flex gap-2 rounded-2xl bg-cream-dark p-3 text-xs leading-relaxed text-charcoal-mid">
                <Info size={15} className="mt-0.5 flex-shrink-0 text-sage-dark" aria-hidden="true" />
                Your latest camera attempt was not reliable enough, so it did not change your Body Mirror.
              </div>
            )}

            <RecommendationActions
              userId={userId}
              mode={bodyMirror.recommendation.mode}
              safetySignals={bodyMirror.safety.signals}
              quickPlan={quickPlan as SessionPlanSummary | null}
              fullPlan={fullPlan}
            />
          </div>
        </section>
      )}

      {bodyMirror && bodyMirror.status !== 'safety_hold' && (
        <section className="px-5 pt-5" aria-labelledby="check-in-heading">
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-sage/25 bg-sage/10 p-4">
            <div>
              <h2 id="check-in-heading" className="text-sm font-semibold text-charcoal">Keep today current</h2>
              <p className="mt-1 text-xs leading-relaxed text-charcoal-mid">A self check-in works even when the camera is unavailable.</p>
            </div>
            <BodyCheckInSheet userId={userId} label={bodyMirror.checkInAsOf ? 'Update' : 'Check in'}
              className="btn-secondary flex-shrink-0 bg-white px-4 py-2.5" />
          </div>
        </section>
      )}

      {!isPro && (
        <aside className="mx-5 mt-5 rounded-2xl border border-border bg-cream-dark px-4 py-3 text-xs text-muted">
          <p className="font-medium text-charcoal-mid">{sessionsLeft} of 3 free sessions left this week</p>
          <UpgradeButton plan="monthly" className="mt-1 text-left font-medium text-sage-dark underline underline-offset-2">
            See unlimited sessions
          </UpgradeButton>
        </aside>
      )}
    </div>
  )
}

function RecommendationActions({ userId, mode, safetySignals, quickPlan, fullPlan }: {
  userId: string
  mode: 'baseline' | 'check_in' | 'quick' | 'full' | 'reassess' | 'pause'
  safetySignals: SafetySignal[]
  quickPlan: SessionPlanSummary | null
  fullPlan: SessionPlanSummary | null
}) {
  if (mode === 'pause') {
    return (
      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-rose/25 bg-white/70 px-4 py-3 text-sm text-charcoal-mid">
          <span className="font-semibold text-rose-dark">Triggered by:</span>{' '}
          {formatSafetySignals(safetySignals)}
        </div>
        <BodyCheckInSheet userId={userId}
          label="Retake safety check-in"
          className="btn-primary w-full" />
      </div>
    )
  }
  if (mode === 'check_in') {
    return (
      <div className="mt-5">
        <BodyCheckInSheet userId={userId}
          label="Start 15-second check-in"
          className="btn-primary w-full" />
      </div>
    )
  }

  if (mode === 'baseline' || mode === 'reassess') {
    return (
      <div className="mt-5">
        <Link href="/assessment" className="btn-primary w-full">
          Start 2-minute assessment <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className="mt-3 rounded-2xl bg-cream-dark px-4 py-3 text-xs leading-relaxed text-charcoal-mid">
          Side arm raise, standing roll down, and seated trunk rotation — no mat needed.
        </div>
      </div>
    )
  }

  const primary = mode === 'full' ? fullPlan : quickPlan
  const secondary = mode === 'full' ? quickPlan : fullPlan
  return (
    <div className="mt-5 grid gap-2.5">
      {primary && (
        <Link href={`/session/${primary.id}`} className="btn-primary w-full">
          {primary.name} · {primary.duration_minutes} min <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
      {secondary && (
        <Link href={`/session/${secondary.id}`} className="btn-secondary w-full bg-white">
          {secondary.name} · {secondary.duration_minutes} min
        </Link>
      )}
    </div>
  )
}

function statusLabel(status: string): string {
  return {
    no_data: 'Start here',
    low_confidence: 'Needs a clearer read',
    check_in_due: 'Check-in due',
    current: 'Current',
    stale: 'Refresh due',
    safety_hold: 'Paused',
  }[status] ?? 'Body Mirror'
}

function formatEvidenceDate(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}
