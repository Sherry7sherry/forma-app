import { createClient } from '@/lib/supabase/server'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: records } = await supabase
    .from('session_records')
    .select(`
      id, form_score, duration_seconds, completed_at,
      exercises_completed, total_exercises, is_partial,
      session_plan:session_plans(name, thumbnail_emoji)
    `)
    .eq('user_id', user!.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  const sessions = records ?? []
  // Only count fully completed sessions in stats and milestones
  const completedSessions = sessions.filter((s: any) => !s.is_partial)
  const partialSessions   = sessions.filter((s: any) => s.is_partial)
  const totalSessions = completedSessions.length
  const totalMinutes  = Math.round(completedSessions.reduce((a: number, s: any) => a + s.duration_seconds, 0) / 60)
  const avgForm       = completedSessions.length
    ? Math.round(completedSessions.reduce((a: number, s: any) => a + s.form_score, 0) / completedSessions.length)
    : 0

  // Streak — only days with at least one completed (non-partial) session
  const days = new Set(completedSessions.map((s: any) => s.completed_at?.split('T')[0]))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    if (days.has(d.toISOString().split('T')[0])) streak++
    else if (i > 0) break
  }

  // Last 7 days chart data — completed sessions only
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    const daySessions = completedSessions.filter((s: any) => s.completed_at?.startsWith(key))
    return {
      day: ['M','T','W','T','F','S','S'][(d.getDay() + 6) % 7],
      score: daySessions.length
        ? Math.round(daySessions.reduce((a: number, s: any) => a + s.form_score, 0) / daySessions.length)
        : 0,
      isToday: i === 6,
    }
  })

  const maxScore = Math.max(...last7.map(d => d.score), 1)

  // Recent history — all sessions, newest first, capped at 20
  const recentHistory = sessions.slice(0, 20)

  return (
    <div className="pt-14 pb-6 fade-up">
      {/* Header */}
      <div className="px-5 pb-5 bg-gradient-to-b from-cream-dark to-cream">
        <h1 className="font-serif text-2xl font-medium mb-1">Your Progress</h1>
        <p className="text-muted text-sm">Keep moving — your body remembers.</p>
      </div>

      {/* Streak banner */}
      {streak > 0 && (
        <div className="mx-5 mb-5 rounded-2xl p-5
                        bg-gradient-to-r from-rose to-rose-dark shadow-soft
                        flex items-center gap-4">
          <span className="text-3xl">🔥</span>
          <div>
            <div className="font-serif text-xl text-white">{streak}-day streak</div>
            <div className="text-white/75 text-xs mt-0.5">
              {streak < 7 ? `${7 - streak} more days for a badge` : 'Amazing consistency!'}
            </div>
          </div>
        </div>
      )}

      {/* Stats overview */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { val: String(totalSessions), label: 'Completed' },
            { val: `${totalMinutes}m`,    label: 'Total minutes' },
            { val: avgForm ? `${avgForm}%` : '—', label: 'Avg form score' },
          ].map(s => (
            <div key={s.label} className="card text-center py-4">
              <div className="font-serif text-2xl text-charcoal mb-0.5">{s.val}</div>
              <div className="text-[11px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly form chart */}
      <div className="mx-5 mb-5">
        <div className="card">
          <div className="font-semibold text-sm text-charcoal mb-0.5">Form score this week</div>
          <div className="text-xs text-muted mb-4">Last 7 days · completed sessions only</div>
          <div className="flex items-end gap-2 h-16">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all duration-700',
                    d.isToday ? 'bg-gradient-to-t from-rose-dark to-rose-light' :
                    d.score > 0 ? 'bg-gradient-to-t from-sage-dark to-sage-light' :
                                  'bg-border'
                  )}
                  style={{ height: d.score ? `${(d.score / maxScore) * 100}%` : '8%' }}
                />
                <span className="text-[10px] text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly goal */}
      <div className="mx-5 mb-5">
        <div className="card flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#E8E2D8" strokeWidth="7"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="#7A9E8E" strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(totalSessions, 20) / 20)}`}
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-serif text-base text-charcoal leading-none">{totalSessions}</span>
              <span className="text-[9px] text-muted">/ 20</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted mb-1">Sessions this month</div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-sage-light to-sage rounded-full"
                   style={{ width: `${Math.min(totalSessions / 20 * 100, 100)}%` }}/>
            </div>
            <div className="text-xs text-sage-dark font-medium">
              {totalSessions >= 20 ? '🎉 Goal reached!' : `${20 - totalSessions} more to hit your goal`}
            </div>
          </div>
        </div>
      </div>

      {/* Recent session history */}
      {recentHistory.length > 0 && (
        <div className="px-5 mb-5">
          <h3 className="font-serif text-lg mb-3">Recent sessions</h3>
          <div className="flex flex-col gap-2.5">
            {recentHistory.map((s: any) => {
              const isPartial = !!s.is_partial
              const completedEx = s.exercises_completed ?? 0
              const totalEx     = s.total_exercises ?? 0
              const pct = totalEx > 0 ? Math.round((completedEx / totalEx) * 100) : 0
              const mins = Math.round(s.duration_seconds / 60)
              const dateStr = new Date(s.completed_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
              })
              return (
                <div key={s.id} className="card flex items-start gap-3 py-3.5">
                  {/* Status icon */}
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5',
                    isPartial ? 'bg-amber-100' : 'bg-sage/15'
                  )}>
                    {(s.session_plan as any)?.thumbnail_emoji ?? '🧘‍♀️'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-charcoal truncate">
                        {(s.session_plan as any)?.name ?? 'Session'}
                      </p>
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                        isPartial
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sage/15 text-sage-dark'
                      )}>
                        {isPartial ? 'Partial' : 'Complete'}
                      </span>
                    </div>

                    {/* Exercise completion bar */}
                    {totalEx > 0 && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', isPartial ? 'bg-amber-400' : 'bg-sage')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted flex-shrink-0">
                          {completedEx}/{totalEx} ex
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span>{dateStr}</span>
                      {mins > 0 && <><span>·</span><span>{mins}m</span></>}
                      {s.form_score > 0 && !isPartial && (
                        <><span>·</span>
                        <span className={cn(
                          'font-semibold',
                          s.form_score >= 85 ? 'text-sage-dark' :
                          s.form_score >= 70 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          {s.form_score}% form
                        </span></>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="px-5">
        <h3 className="font-serif text-lg mb-3">Milestones</h3>
        <div className="flex flex-col gap-3">
          {MILESTONES.map(m => {
            const unlocked = totalSessions >= m.threshold || streak >= (m.streak ?? 999)
            return (
              <div key={m.name} className={cn('card flex items-center gap-4', !unlocked && 'opacity-50')}>
                <div className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                  unlocked ? 'bg-sage/15' : 'bg-cream-dark grayscale'
                )}>
                  {m.emoji}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-charcoal">{m.name}</div>
                  <div className="text-xs text-muted">{m.desc}</div>
                </div>
                <span className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-full',
                  unlocked ? 'bg-sage/15 text-sage-dark' : 'bg-border text-muted'
                )}>
                  {unlocked ? 'Done' : 'Soon'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Partial sessions note — shown at bottom for context, grammar-correct */}
      {partialSessions.length > 0 && (
        <div className="mx-5 mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-0.5">Partial sessions not counted</p>
          <p className="text-xs text-amber-600">
            {partialSessions.length === 1
              ? '1 session was saved before completion and is not included in your stats.'
              : `${partialSessions.length} sessions were saved before completion and are not included in your stats.`}
          </p>
        </div>
      )}
    </div>
  )
}

const MILESTONES = [
  { emoji: '🌱', name: 'First Session',       desc: 'Complete your first Forma session', threshold: 1,  streak: undefined },
  { emoji: '🔥', name: '5-Day Streak',        desc: 'Move 5 days in a row',               threshold: 99, streak: 5 },
  { emoji: '💪', name: '10 Sessions',          desc: 'Complete 10 sessions total',         threshold: 10, streak: undefined },
  { emoji: '🧍‍♀️', name: 'Alignment Improver',  desc: 'Reach 80% average form score',      threshold: 20, streak: undefined },
  { emoji: '⭐', name: '7-Day Streak',         desc: 'Move every day for a week',          threshold: 99, streak: 7 },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
