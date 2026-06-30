import { CheckCircle2, Clock3, Footprints, History, Save } from 'lucide-react'

import BodyMirrorDimensions from '@/components/body-mirror/BodyMirrorDimensions'
import { loadBodyMirrorForUser } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/server'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [bodyMirrorLoad, { data: recentRecords }] = await Promise.all([
    loadBodyMirrorForUser(supabase, userId),
    supabase.from('session_records')
      .select(`
        id, duration_seconds, completed_at, exercises_completed,
        total_exercises, is_partial,
        session_plan:session_plans(name)
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(12),
  ])
  const bodyMirror = bodyMirrorLoad.result

  return (
    <div className="fade-up pb-6 pt-14">
      <header className="px-5 pb-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">Your Body Mirror</p>
        <h1 className="font-serif text-2xl font-medium">Progress</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">Has movement helped your body feel and move better?</p>
      </header>

      {!bodyMirror ? (
        <section className="mx-5 rounded-3xl border border-border bg-white p-5 shadow-card">
          <h2 className="font-serif text-xl">Body data is unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">We could not load your evidence, so Progress will not substitute zeros or an old form score.</p>
        </section>
      ) : (
        <>
          <section className="px-5" aria-labelledby="change-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 id="change-heading" className="font-serif text-lg">What is changing</h2>
                <p className="mt-1 text-xs text-muted">Comfort, Mobility, and Movement control compared only with your baseline.</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide
                ${bodyMirror.freshness.level === 'stale' ? 'bg-rose/15 text-rose-dark' : 'bg-sage/15 text-sage-dark'}`}>
                {bodyMirror.freshness.level === 'none' ? 'No baseline' : bodyMirror.freshness.level}
              </span>
            </div>
            <BodyMirrorDimensions result={bodyMirror} />
          </section>

          {bodyMirror.confidenceNotice === 'latest_attempt_not_applied' && (
            <div className="mx-5 mt-4 rounded-2xl border border-border bg-cream-dark px-4 py-3 text-xs leading-relaxed text-charcoal-mid">
              The latest camera attempt is kept in your history but did not update these dimensions because confidence was too low.
            </div>
          )}

          <section className="px-5 pt-7" aria-labelledby="supporting-heading">
            <div className="mb-3">
              <h2 id="supporting-heading" className="font-serif text-lg">Practice evidence</h2>
              <p className="mt-1 text-xs text-muted">Useful context, not the definition of progress.</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <ActivityStat icon={CheckCircle2} value={String(bodyMirror.activity.completedSessions)} label="Completed" />
              <ActivityStat icon={Clock3} value={`${bodyMirror.activity.completedMinutes}m`} label="Minutes" />
              <ActivityStat icon={Footprints} value={String(bodyMirror.activity.currentStreak)} label="Day rhythm" />
            </div>
            {bodyMirror.activity.partialAttempts > 0 && (
              <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Save size={16} className="mt-0.5 flex-shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-amber-700">
                  Partial attempts are saved as evidence: {bodyMirror.activity.partialAttempts}. They are not counted as completed sessions, minutes, or streak days.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="px-5 pt-7" aria-labelledby="history-heading">
        <div className="mb-3 flex items-center gap-2">
          <History size={18} className="text-sage-dark" aria-hidden="true" />
          <h2 id="history-heading" className="font-serif text-lg">Recent practice</h2>
        </div>
        {recentRecords?.length ? (
          <div className="grid gap-2.5">
            {recentRecords.map(record => {
              const plan = record.session_plan as unknown as { name: string } | null
              const completedAt = record.completed_at as string
              const minutes = Math.max(1, Math.round(record.duration_seconds / 60))
              return (
                <article key={record.id} className="card flex items-center gap-3 py-3.5">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl
                    ${record.is_partial ? 'bg-amber-100 text-amber-700' : 'bg-sage/15 text-sage-dark'}`}>
                    {record.is_partial ? <Save size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold">{plan?.name ?? 'Movement session'}</h3>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide
                        ${record.is_partial ? 'text-amber-700' : 'text-sage-dark'}`}>
                        {record.is_partial ? 'Partial' : 'Complete'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      <time dateTime={completedAt}>{formatHistoryDate(completedAt)}</time> · {minutes} min
                      {record.total_exercises > 0 && ` · ${record.exercises_completed}/${record.total_exercises} movements`}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-white/60 p-5">
            <p className="text-sm font-semibold text-charcoal">No practice evidence yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Your first completed or partial movement session will appear here.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function ActivityStat({ icon: Icon, value, label }: {
  icon: typeof CheckCircle2
  value: string
  label: string
}) {
  return (
    <div className="card px-2 py-4 text-center">
      <Icon size={15} className="mx-auto mb-2 text-sage-dark" aria-hidden="true" />
      <div className="font-serif text-xl text-charcoal">{value}</div>
      <div className="mt-1 text-[10px] font-medium text-muted">{label}</div>
    </div>
  )
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}
