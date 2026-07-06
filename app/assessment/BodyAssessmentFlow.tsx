'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import MovementAssessmentCapture, {
  MOVEMENT_ASSESSMENT_ITEMS,
} from '@/components/assessment/MovementAssessmentCapture'
import {
  buildAssessmentCompletion,
  buildAssessmentInsert,
  buildObservationInserts,
  type AssessmentFailureReason,
  type AssessmentKind,
  type DerivedObservation,
} from '@/lib/bodyAssessment'
import { buildBodyCheckInInsert } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/client'
import { assertSupabaseSuccess } from '@/lib/supabaseErrors'
import { trackAssessmentEvent } from '@/lib/assessmentAnalytics'

type Stage = 'intro' | 'check_in' | 'capture' | 'fallback' | 'result'
type ResultOutcome = 'completed' | 'low_confidence' | 'camera_unavailable' | 'safety_hold'

const COMFORT_OPTIONS = [1, 2, 3, 4, 5]
const SAFETY_SIGNALS = [
  ['sharp_pain', 'Sharp pain'],
  ['numbness', 'Numbness'],
  ['radiating_pain', 'Radiating pain'],
  ['dizziness', 'Dizziness'],
  ['chest_pain', 'Chest pain'],
  ['shortness_of_breath', 'Shortness of breath'],
  ['sudden_weakness', 'Sudden weakness'],
  ['professional_pause', 'Professional instruction to pause'],
] as const

export default function BodyAssessmentFlow({ userId, kind }: { userId: string; kind: AssessmentKind }) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const assessmentIdRef = useRef<string | null>(null)
  const checkInIdRef = useRef<string | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [comfort, setComfort] = useState<number | null>(null)
  const [safetySignals, setSafetySignals] = useState<string[]>([])
  const [fallbackIndex, setFallbackIndex] = useState(0)
  const [fallbackAnswers, setFallbackAnswers] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<ResultOutcome | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackMovement = MOVEMENT_ASSESSMENT_ITEMS[fallbackIndex]

  useEffect(() => {
    if (!assessmentIdRef.current || stage === 'result') return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  function toggleSafety(value: string) {
    setSafetySignals(values => values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value])
  }

  async function ensureAssessment(): Promise<string> {
    if (assessmentIdRef.current) return assessmentIdRef.current
    const row = buildAssessmentInsert({
      userId,
      kind,
      captureMode: 'camera',
      bodyCheckInId: checkInIdRef.current,
    })
    const result = await supabaseRef.current.from('movement_assessments').insert(row).select('id').single()
    assertSupabaseSuccess(result, 'Start movement assessment')
    assessmentIdRef.current = result.data!.id
    return result.data!.id
  }

  async function saveCheckIn() {
    if (comfort === null || saving) return
    setSaving(true)
    setError(null)
    try {
      const row = buildBodyCheckInInsert({
        userId,
        context: kind === 'baseline' ? 'baseline' : 'pre_session',
        comfort,
        focusAreas: [],
        safetySignals,
      })
      const result = await supabaseRef.current.from('body_check_ins').insert(row).select('id').single()
      assertSupabaseSuccess(result, 'Save assessment check-in')
      checkInIdRef.current = result.data!.id
      if (safetySignals.length > 0) {
        setOutcome('safety_hold')
        setStage('result')
      } else {
        await ensureAssessment()
        setStage('capture')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your check-in.')
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete(result: {
    observations: DerivedObservation[]
    overallConfidence: number
  }) {
    const assessmentId = assessmentIdRef.current
    if (!assessmentId || saving) return
    setSaving(true)
    setError(null)
    try {
      const rows = buildObservationInserts({
        assessmentId,
        userId,
        observations: result.observations,
      })
      const observationResult = await supabaseRef.current.from('movement_observations').upsert(rows, {
        onConflict: 'assessment_id,movement_key,dimension,side,metric_key',
      })
      assertSupabaseSuccess(observationResult, 'Save movement observations')
      const completion = buildAssessmentCompletion({
        outcome: 'completed',
        overallConfidence: result.overallConfidence,
      })
      const completionResult = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
      assertSupabaseSuccess(completionResult, 'Complete movement assessment')
      if (kind === 'reassessment') {
        trackAssessmentEvent('reassessment_complete', {
          step_name: 'reassessment',
          outcome: 'completed',
          confidence_bucket: result.overallConfidence >= 0.85 ? 'high' : 'medium',
        })
      }
      setOutcome('completed')
      setStage('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this assessment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLowConfidence(result: {
    overallConfidence: number
    reason: AssessmentFailureReason
  }) {
    const assessmentId = assessmentIdRef.current
    if (!assessmentId || saving) return
    setSaving(true)
    setError(null)
    try {
      const completion = buildAssessmentCompletion({
        outcome: 'low_confidence',
        overallConfidence: result.overallConfidence,
      })
      const saveResult = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
      assertSupabaseSuccess(saveResult, 'Save low-confidence assessment')
      setOutcome('low_confidence')
      setStage('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this attempt.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCameraUnavailable() {
    const assessmentId = assessmentIdRef.current
    if (!assessmentId || saving) return
    setSaving(true)
    setError(null)
    try {
      const completion = buildAssessmentCompletion({ outcome: 'camera_unavailable' })
      const result = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
      assertSupabaseSuccess(result, 'Save camera-unavailable assessment')
      setFallbackIndex(0)
      setStage('fallback')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue without the camera.')
    } finally {
      setSaving(false)
    }
  }

  async function saveFallbackAnswer(value: string) {
    if (saving) return
    const next = { ...fallbackAnswers, [fallbackMovement.key]: value }
    setSaving(true)
    setError(null)
    try {
      if (checkInIdRef.current) {
        const result = await supabaseRef.current.from('body_check_ins')
          .update({ notes: JSON.stringify({ movement_self_report: next }) })
          .eq('id', checkInIdRef.current)
        assertSupabaseSuccess(result, 'Save movement self-report')
      }
      setFallbackAnswers(next)
      if (fallbackIndex < MOVEMENT_ASSESSMENT_ITEMS.length - 1) {
        setFallbackIndex(index => index + 1)
      } else {
        setOutcome('camera_unavailable')
        setStage('result')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your self-report.')
    } finally {
      setSaving(false)
    }
  }

  async function exitAssessment() {
    const assessmentId = assessmentIdRef.current
    if (!assessmentId) {
      router.push('/home')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await supabaseRef.current.from('movement_assessments')
        .update(buildAssessmentCompletion({ outcome: 'partial' }))
        .eq('id', assessmentId)
      assertSupabaseSuccess(result, 'Save partial assessment')
      router.push('/home')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your partial assessment.')
      setSaving(false)
    }
  }

  async function restart() {
    setSaving(true)
    setError(null)
    try {
      assessmentIdRef.current = null
      setFallbackIndex(0)
      setFallbackAnswers({})
      setOutcome(null)
      await ensureAssessment()
      setStage('capture')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to restart the assessment.')
    } finally {
      setSaving(false)
    }
  }

  if (stage === 'capture') {
    return (
      <main className="min-h-dvh bg-cream text-charcoal">
        <div className="mx-auto min-h-dvh w-full max-w-lg">
          <MovementAssessmentCapture
            constraints={[]}
            onComplete={result => void handleComplete(result)}
            onLowConfidence={result => void handleLowConfidence(result)}
            onCameraUnavailable={() => void handleCameraUnavailable()}
            onExit={() => void exitAssessment()}
          />
          {error && <div className="fixed inset-x-5 bottom-5 z-50 mx-auto max-w-md"><ErrorMessage message={error} /></div>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-cream text-charcoal">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <header className="flex items-center justify-between px-5 pb-4 pt-12">
          <button type="button" onClick={() => void exitAssessment()} disabled={saving}
            className="inline-flex items-center gap-2 text-sm font-medium text-charcoal-mid disabled:opacity-50">
            <ArrowLeft size={17} aria-hidden="true" /> Exit
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sage-dark">Body assessment</p>
        </header>

        {stage === 'intro' && (
          <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-4">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/15 text-sage-dark"><Camera size={25} aria-hidden="true" /></div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">Personal starting point</p>
              <h1 className="mt-2 font-serif text-4xl leading-tight">Meet your body where it is today.</h1>
              <p className="mt-4 text-base leading-relaxed text-charcoal-mid">Three simple, no-mat movements create a baseline that is compared only with you.</p>
              <div className="mt-7 grid gap-3">
                <InfoRow icon={<Clock3 size={18} />} title="About 2 minutes" detail="Move slowly in your comfortable range." />
                <InfoRow icon={<Camera size={18} />} title="Camera-supported" detail="You can continue with self-report if the camera is unavailable." />
                <InfoRow icon={<ShieldAlert size={18} />} title="Not a diagnosis" detail="Stop signals pause movement recommendations." />
              </div>
            </div>
            <button type="button" onClick={() => setStage('check_in')} className="btn-primary mt-8 w-full">Start assessment <ArrowRight size={17} aria-hidden="true" /></button>
          </section>
        )}

        {stage === 'check_in' && (
          <section className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">First, a quick check-in</p>
            <h1 className="mt-2 font-serif text-3xl">How does your body feel?</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">This self-report guides safety and comfort. It is not a diagnosis.</p>
            <fieldset className="mt-7">
              <legend className="text-sm font-semibold">Overall comfort right now</legend>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {COMFORT_OPTIONS.map(value => (
                  <button key={value} type="button" onClick={() => setComfort(value)} aria-pressed={comfort === value} aria-label={`${value} out of 5`}
                    className={`min-h-14 rounded-2xl border font-serif text-lg ${comfort === value ? 'border-sage bg-sage text-white' : 'border-border bg-white text-charcoal-mid'}`}>
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted"><span>Uncomfortable</span><span>Comfortable</span></div>
            </fieldset>
            <fieldset className="mt-7 rounded-3xl border border-rose/25 bg-rose/10 p-4">
              <legend className="px-1 text-sm font-semibold">Any stop signals right now?</legend>
              <p className="mt-1 text-xs leading-relaxed text-charcoal-mid">Select any that apply. Forma will pause movement recommendations.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SAFETY_SIGNALS.map(([value, label]) => {
                  const selected = safetySignals.includes(value)
                  return (
                    <button key={value} type="button" onClick={() => toggleSafety(value)} aria-pressed={selected}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-medium ${selected ? 'border-rose-dark bg-white text-rose-dark' : 'border-rose/20 bg-white/70 text-charcoal-mid'}`}>
                      {selected && <Check size={13} className="mr-1 inline" aria-hidden="true" />}{label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {error && <ErrorMessage message={error} />}
            <button type="button" onClick={() => void saveCheckIn()} disabled={comfort === null || saving}
              className="btn-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-45">
              {saving ? 'Saving…' : safetySignals.length ? 'Save and pause' : 'Continue to movements'}
            </button>
          </section>
        )}

        {stage === 'fallback' && (
          <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-4">
            <div>
              <span className="rounded-full bg-cream-dark px-3 py-1.5 text-xs font-semibold text-charcoal-mid">Self-report · {fallbackIndex + 1} of 3</span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-sage-dark">Continue with self-report</p>
              <h1 className="mt-2 font-serif text-3xl">How did {fallbackMovement.title.toLowerCase()} feel?</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">This is saved as context only. It will not create numeric Mobility or Movement control data.</p>
              <div className="mt-7 grid gap-3">
                {['Easy and comfortable', 'Limited or stiff', 'Uncomfortable — I stopped'].map(value => (
                  <button key={value} type="button" onClick={() => void saveFallbackAnswer(value)} disabled={saving}
                    className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-white px-4 text-left text-sm font-medium disabled:opacity-50">
                    {value}<ArrowRight size={16} className="text-sage-dark" aria-hidden="true" />
                  </button>
                ))}
              </div>
              {error && <ErrorMessage message={error} />}
            </div>
          </section>
        )}

        {stage === 'result' && outcome && (
          <ResultView outcome={outcome} onRetry={() => void restart()} onDone={() => router.push('/home')} />
        )}
      </div>
    </main>
  )
}

function InfoRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-white p-4">
      <div className="mt-0.5 text-sage-dark">{icon}</div>
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p></div>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="mt-4 rounded-2xl bg-rose/15 p-3 text-sm font-medium text-rose-dark">{message}</p>
}

function ResultView({ outcome, onRetry, onDone }: { outcome: ResultOutcome; onRetry: () => void; onDone: () => void }) {
  const content = {
    completed: {
      icon: <CheckCircle2 size={28} />,
      eyebrow: 'Baseline ready',
      title: 'Your Body Mirror has a starting point.',
      body: 'Future reliable checks will be compared only with this personal baseline.',
    },
    low_confidence: {
      icon: <RefreshCw size={28} />,
      eyebrow: 'Evidence saved',
      title: 'We need a clearer camera read.',
      body: 'This attempt is kept in your history but did not update Mobility or Movement control.',
    },
    camera_unavailable: {
      icon: <Camera size={28} />,
      eyebrow: 'Self-report saved',
      title: 'Your movement mirror still needs a camera check.',
      body: 'You can continue using Forma. Try the two-minute assessment again when a camera is available.',
    },
    safety_hold: {
      icon: <AlertTriangle size={28} />,
      eyebrow: 'Movement paused',
      title: 'Stop movement for now.',
      body: 'Your check-in includes a stop signal. Seek appropriate medical advice before continuing.',
    },
  }[outcome]
  const retryable = outcome === 'low_confidence' || outcome === 'camera_unavailable'
  return (
    <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-8">
      <div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${outcome === 'safety_hold' ? 'bg-rose/15 text-rose-dark' : 'bg-sage/15 text-sage-dark'}`}>{content.icon}</div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">{content.eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight">{content.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-charcoal-mid">{content.body}</p>
      </div>
      <div className="mt-8 grid gap-2.5">
        {retryable && <button type="button" onClick={onRetry} className="btn-secondary w-full bg-white">Try assessment again</button>}
        <button type="button" onClick={onDone} className="btn-primary w-full">Return to Home</button>
      </div>
    </section>
  )
}
