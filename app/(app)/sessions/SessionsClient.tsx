'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const FILTERS = ['All', 'Recovery', 'Strength', 'Flexibility', 'Alignment', 'Core']

const CATEGORY_COLORS: Record<string, string> = {
  spine:      'from-sage-dark to-[#3D6B5A]',
  core:       'from-green-600 to-green-800',
  hips:       'from-amber-500 to-amber-700',
  shoulders:  'from-rose to-rose-dark',
  full_body:  'from-sage to-sage-dark',
  cool_down:  'from-purple-400 to-purple-700',
}

export default function SessionsClient({ plans, isPro }: { plans: any[]; isPro: boolean }) {
  const [filter, setFilter] = useState('All')

  const filtered = plans.filter(p => {
    if (filter === 'All') return true
    const f = filter.toLowerCase()
    return (
      p.goals?.some((g: string) => g.includes(f)) ||
      p.category?.includes(f) ||
      p.focus_areas?.some((a: string) => a.includes(f))
    )
  })

  return (
    <div className="pt-14 pb-6">
      {/* Header */}
      <div className="px-5 mb-5 fade-up">
        <h1 className="font-serif text-2xl font-medium mb-1">Sessions</h1>
        <p className="text-muted text-sm">Pilates-based movement, built for you.</p>
      </div>

      {/* Filter chips — wrap layout, no horizontal scroll clipping */}
      <div className="px-5 mb-5 flex flex-wrap gap-2 fade-up">
        {FILTERS.map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={cn('chip transition-all', filter === f && 'chip-active')}>
            {f}
          </button>
        ))}
      </div>

      {/* Session cards */}
      <div className="px-5 flex flex-col gap-4">
        {filtered.map((p, i) => {
          const locked = p.is_pro && !isPro
          return (
            <Link key={p.id}
              href={locked ? '/profile#upgrade' : `/session/${p.id}`}
              className="card p-0 overflow-hidden active:scale-[.98] transition-transform block fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Thumbnail */}
              <div className={cn(
                'h-[100px] bg-gradient-to-br flex items-center px-5 gap-4',
                CATEGORY_COLORS[p.category] ?? 'from-sage to-sage-dark'
              )}>
                <div className="text-4xl">{p.thumbnail_emoji}</div>
                <div>
                  <h3 className="font-serif text-lg text-white leading-tight">{p.name}</h3>
                  <p className="text-white/70 text-xs mt-1 capitalize">
                    {p.category?.replace('_', ' ')} · {p.difficulty}
                  </p>
                </div>
                {locked && (
                  <div className="ml-auto">
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      PRO
                    </span>
                  </div>
                )}
              </div>
              {/* Meta row */}
              <div className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex gap-4 text-muted text-xs">
                  <span>⏱ {p.duration_minutes} min</span>
                </div>
                {p.goals?.[0] && (
                  <span className={cn(
                    'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                    p.goals[0] === 'recovery'    ? 'bg-sage/15 text-sage-dark' :
                    p.goals[0] === 'strength'    ? 'bg-amber-100 text-amber-800' :
                    p.goals[0] === 'alignment'   ? 'bg-rose/15 text-rose-dark' :
                                                   'bg-sage/15 text-sage-dark'
                  )}>
                    {p.goals[0]}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
