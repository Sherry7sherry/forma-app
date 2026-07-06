'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Eye, Link2, ShieldCheck } from 'lucide-react'

import { readGuestAssessment, type GuestAssessmentPayload } from '@/lib/assessmentIntake'
import { bodyMirrorForGuestAssessment } from '@/lib/assessmentReport'
import { evaluateCoaching } from '@/lib/coachingPolicy'
import { trackAssessmentEvent } from '@/lib/assessmentAnalytics'

const WORK_CONTEXT: Record<string, string> = {
  sitting_under_4h: 'you spend part of the workday sitting',
  sitting_4_8h: 'you sit for four to eight hours on a typical day',
  sitting_over_8h: 'you sit for more than eight hours on a typical day',
  mostly_moving: 'you spend most of the day standing or moving',
}

export default function GuestInsightPage() {
  const [payload, setPayload] = useState<GuestAssessmentPayload | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPayload(readGuestAssessment(window.sessionStorage))
    setLoaded(true)
  }, [])

  const insight = useMemo(() => {
    if (payload?.route.mode === 'stop' || payload?.capture?.status !== 'completed') return null
    const coaching = evaluateCoaching({
      intake: payload.intake,
      route: payload.route,
      bodyMirror: bodyMirrorForGuestAssessment(),
      observations: payload.capture.observations.map((observation, index) => ({
        id: `guest-observation-${index + 1}`,
        metricKey: observation.metricKey,
        value: observation.value,
        confidence: observation.confidence,
      })),
      exercises: [{
        id: 'gentle-trunk-control',
        focusAreas: ['trunk_control', ...payload.intake.goals],
        painSensitiveRegions: [],
        difficulty: 'gentle',
      }],
    })
    return [...coaching.insights].sort((a, b) => b.confidence - a.confidence)[0] ?? null
  }, [payload])

  useEffect(() => {
    if (insight) trackAssessmentEvent('first_insight', { step_name: 'first_insight', outcome: 'viewed' })
  }, [insight])

  if (!loaded) return <main className="min-h-dvh bg-cream" aria-label="Loading insight" />

  if (!payload || !insight) {
    return (
      <main className="flex min-h-dvh items-center bg-cream px-5 text-charcoal">
        <section className="mx-auto w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-card">
          <ShieldCheck size={28} className="text-sage-dark" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-3xl">We need a clearer movement read.</h1>
          <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">There is not enough reliable camera evidence for a movement insight. No number or conclusion has been filled in.</p>
          <Link href="/body-assessment" className="btn-primary mt-7 w-full">Try the assessment again</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-cream px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-charcoal sm:pt-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="font-serif text-xl font-medium">Forma<span className="text-sage">.</span></div>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">Your first body insight</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">One thing stood out clearly.</h1>

        <section className="mt-7 overflow-hidden rounded-4xl bg-sage-dark text-white shadow-soft">
          <div className="p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-sage-light"><Eye size={23} aria-hidden="true" /></div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-sage-light">Movement observation</p>
            <h2 className="mt-2 font-serif text-2xl leading-snug">{insight.allowedClaim}</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">This is a camera-supported movement observation, not a diagnosis or a comparison with anyone else.</p>
          </div>
          <div className="border-t border-white/12 bg-black/10 px-6 py-5">
            <div className="flex gap-3">
              <Link2 size={18} className="mt-0.5 flex-none text-sage-light" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-white/78">
                Because {WORK_CONTEXT[payload.intake.workPattern]}, trunk control and comfortable shoulder movement are useful first areas to explore.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-border bg-white p-4 text-xs leading-relaxed text-muted">
          Your answers and derived observations are still only in this browser session. The next action gives consent to save them to your account.
        </div>

        <Link href="/signup?next=%2Fbody-assessment%2Fsave"
          onClick={() => trackAssessmentEvent('registration_redirect', { step_name: 'registration', outcome: 'redirected' })}
          className="btn-primary mt-7 min-h-14 w-full text-center text-base">
          Save my body starting point and view my report <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </main>
  )
}
