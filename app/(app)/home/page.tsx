import { createClient } from '@/lib/supabase/server'
import { getGreeting, getDayName, startOfWeekISO } from '@/lib/utils'
import Link from 'next/link'
import { UpgradeButton } from '@/components/billing/BillingButton'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: sessions }, { data: featuredSession }, { data: partialRecords }] = await Promise.all([
    supabase.from('user_profiles').select('full_name, subscription_status').eq('id', user!.id).single(),
    supabase.from('session_records')
      .select('id, form_score, duration_seconds, completed_at, is_partial, exercises_completed, total_exercises')
      .eq('user_id', user!.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20),
    supabase.from('session_plans')
      .select('id, name, description, duration_minutes, difficulty, thumbnail_emoji, thumbnail_color, goals, focus_areas')
      .eq('is_pro', false)
      .limit(1)
      .single(),
    // Any partial session for the featured plan
    supabase.from('session_records')
      .select('id, session_plan_id, exercises_completed, total_exercises, skipped_exercises, completed_at')
      .eq('user_id', user!.id)
      .eq('is_partial', true)
      .order('completed_at', { ascending: false })
      .limit(5),
  ])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const isPro     = profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'
  // Count from the start of the current week (Monday) so this matches the
  // "resets Monday" copy and the server-side free-tier quota.
  const weekStart = new Date(startOfWeekISO())
  const allThisWeek = sessions?.filter(s => new Date(s.completed_at!) >= weekStart) ?? []
  // Only count fully completed sessions in stats
  const thisWeek = allThisWeek.filter(s => !s.is_partial)
  const sessionsLeft = Math.max(0, 3 - thisWeek.length)
  const avgForm = thisWeek.length
    ? Math.round(thisWeek.reduce((a, s) => a + s.form_score, 0) / thisWeek.length)
    : 0

  // Calculate streak (consecutive days with sessions)
  const completedAll = sessions?.filter(s => !s.is_partial) ?? []
  const streak = calcStreak(completedAll)

  // Partial session for featured plan (if any)
  const featuredPartial = featuredSession
    ? partialRecords?.find(p => p.session_plan_id === featuredSession.id)
    : null

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="pt-14 px-5 pb-5">
        <p className="text-muted text-sm mb-1">{getGreeting()} ✨</p>
        <h1 className="font-serif text-2xl font-medium">Welcome back, {firstName}</h1>
        <p className="text-muted text-xs mt-1">{getDayName()}</p>
        {!isPro && (
          <div className={`mt-3 flex flex-col gap-1 rounded-2xl px-4 py-3 text-xs
            ${sessionsLeft === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-sage/10'}`}>
            <div className={`flex items-center gap-1.5 font-semibold
              ${sessionsLeft === 0 ? 'text-amber-700' : 'text-sage-dark'}`}>
              {sessionsLeft === 0
                ? <><span>⚠</span> No free sessions left this week</>
                : <><span>🌿</span> {sessionsLeft} of 3 free sessions left · resets Monday</>
              }
            </div>
            <div className={sessionsLeft === 0 ? 'text-amber-600' : 'text-sage-dark/70'}>
              <UpgradeButton plan="monthly" className="underline font-medium text-left">
                Upgrade for unlimited sessions + AI form analysis →
              </UpgradeButton>
            </div>
          </div>
        )}
      </div>

      {/* Hero session card */}
      {featuredSession && (
        <Link href={`/session/${featuredSession.id}`}
          className="mx-5 mb-5 rounded-3xl overflow-hidden block
                     bg-gradient-to-br from-sage-dark to-[#3D6B5A]
                     shadow-[0_12px_32px_rgba(0,0,0,.12)] active:scale-[.98] transition-transform">
          <div className="relative p-6 pb-5">
            {/* Decorative circles */}
            <div className="absolute -right-5 -top-5 w-28 h-28 rounded-full bg-white/8"/>
            <div className="absolute right-5 -bottom-8 w-20 h-20 rounded-full bg-white/5"/>

            <p className="text-white/65 text-xs font-semibold uppercase tracking-widest mb-2">
              {featuredPartial ? 'In progress' : 'Today\'s session'}
            </p>
            <h2 className="font-serif text-xl text-white mb-2">{featuredSession.name}</h2>

            {/* Resume progress summary */}
            {featuredPartial && (() => {
              const done    = featuredPartial.exercises_completed ?? 0
              const total   = featuredPartial.total_exercises || 1
              const skipped = (featuredPartial as any).skipped_exercises ?? 0
              const remain  = total - done - skipped
              return (
                <div className="mb-4">
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-white/70 rounded-full"
                      style={{ width: `${Math.round((done / total) * 100)}%` }}/>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-white/65 text-xs">
                    <span>{done} completed</span>
                    {skipped > 0 && <><span>·</span><span>{skipped} skipped</span></>}
                    <span>·</span><span>{remain > 0 ? remain : 0} remaining</span>
                    {featuredPartial.completed_at && (
                      <><span>·</span><span>saved {formatSavedAgo(featuredPartial.completed_at)}</span></>
                    )}
                  </div>
                </div>
              )
            })()}

            {!featuredPartial && (
              <div className="flex gap-4 text-white/70 text-xs mb-5">
                <span className="flex items-center gap-1">
                  <ClockIcon/>{featuredSession.duration_minutes} min
                </span>
                <span className="flex items-center gap-1">
                  <BoltIcon/>{featuredSession.difficulty}
                </span>
                <span className="flex items-center gap-1">
                  <HeartIcon/>Recovery focus
                </span>
              </div>
            )}

            <div className="inline-flex items-center gap-2 bg-white text-sage-dark
                            rounded-full px-5 py-2.5 text-sm font-semibold shadow-md">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#5A7D6E">
                <path d="M5 3l14 9-14 9V3z"/>
              </svg>
              {featuredPartial ? 'Resume session' : 'Start session'}
            </div>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg">This week</h3>
          <Link href="/progress" className="text-sage text-xs font-medium">See all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { val: String(thisWeek.length), label: 'Sessions' },
            { val: avgForm ? `${avgForm}%` : '—', label: 'Form avg' },
            { val: `${streak} 🔥`, label: 'Day streak' },
          ].map(s => (
            <div key={s.label} className="card text-center py-4">
              <div className="font-serif text-2xl text-charcoal mb-0.5">{s.val}</div>
              <div className="text-[11px] text-muted font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested sessions */}
      <SuggestedSessions supabase={supabase} isPro={isPro} />
    </div>
  )
}

async function SuggestedSessions({ supabase, isPro }: { supabase: any; isPro: boolean }) {
  const { data: plans } = await supabase
    .from('session_plans')
    .select('id, name, duration_minutes, difficulty, thumbnail_emoji, goals, is_pro')
    .order('created_at')
    .limit(4)

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">Suggested for you</h3>
      </div>
      <div className="flex flex-col gap-2.5">
        {(plans ?? []).map((p: any) => (
          <Link key={p.id} href={`/session/${p.id}`}
            className="card flex items-center gap-4 active:bg-cream-dark transition-colors">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sage-light to-sage
                            flex items-center justify-center text-xl flex-shrink-0">
              {p.thumbnail_emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-charcoal truncate">{p.name}</div>
              <div className="text-xs text-muted mt-0.5">{p.duration_minutes} min · {p.difficulty}</div>
            </div>
            {p.is_pro && !isPro
              ? <span className="tag-warm text-[10px]">PRO</span>
              : <span className="tag-sage">{p.goals?.[0] ?? 'session'}</span>
            }
          </Link>
        ))}
      </div>
    </div>
  )
}

function formatSavedAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function calcStreak(sessions: any[]): number {
  if (!sessions.length) return 0
  const days = new Set(sessions.map(s => s.completed_at?.split('T')[0]))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (days.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

function ClockIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function BoltIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
}
function HeartIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
