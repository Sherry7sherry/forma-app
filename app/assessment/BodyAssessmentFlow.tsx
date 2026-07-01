'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
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

import type { CameraLifecycleStatus, PoseResult } from '@/components/camera/PoseCamera'
import {
  buildAssessmentCompletion,
  buildAssessmentInsert,
  buildObservationInserts,
  deriveMovementObservations,
  type AssessmentKind,
  type AssessmentPoseSample,
} from '@/lib/bodyAssessment'
import { buildBodyCheckInInsert, type BodyMirrorMovement } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/client'
import { assertSupabaseSuccess } from '@/lib/supabaseErrors'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

type Stage = 'intro' | 'check_in' | 'setup' | 'capture' | 'fallback' | 'result'
type ResultOutcome = 'completed' | 'low_confidence' | 'camera_unavailable' | 'safety_hold'

const MOVEMENTS: Array<{
  key: BodyMirrorMovement
  title: string
  view: string
  exerciseName: string
  instruction: string
  cue: string
}> = [
  {
    key: 'side_arm_raise',
    title: 'Standing arm raise',
    view: 'Side view',
    exerciseName: 'Arm Arcs',
    instruction: 'Stand side-on with your whole body visible, arms relaxed by your sides.',
    cue: 'Slowly raise both arms overhead, then lower them once.',
  },
  {
    key: 'standing_roll_down',
    title: 'Standing Roll Down',
    view: 'Side view',
    exerciseName: 'Standing Roll Down',
    instruction: 'Stay side-on with feet grounded and arms relaxed.',
    cue: 'Roll down slowly, pause at your comfortable range, then return to standing.',
  },
  {
    key: 'seated_trunk_rotation',
    title: 'Seated trunk rotation',
    view: 'Front view',
    exerciseName: 'Spine Twist',
    instruction: 'Sit tall facing the camera with shoulders and hips clearly visible.',
    cue: 'Rotate gently left, return to center, then rotate right.',
  },
]

const COMFORT_OPTIONS = [1, 2, 3, 4, 5]
const SAFETY_SIGNALS = [
  ['sharp_pain', 'Sharp pain'],
  ['numbness', 'Numbness'],
  ['radiating_pain', 'Radiating pain'],
  ['dizziness', 'Dizziness'],
  ['chest_pain', 'Chest pain'],
  ['shortness_of_breath', 'Shortness of breath'],
  ['sudden_weakness', 'Sudden weakness'],
] as const

export default function BodyAssessmentFlow({ userId, kind }: { userId: string; kind: AssessmentKind }) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const samplesRef = useRef<AssessmentPoseSample[]>([])
  const confidencesRef = useRef<number[]>([])
  const lastSampleAtRef = useRef(0)
  const assessmentIdRef = useRef<string | null>(null)
  const checkInIdRef = useRef<string | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [movementIndex, setMovementIndex] = useState(0)
  const [comfort, setComfort] = useState<number | null>(null)
  const [safetySignals, setSafetySignals] = useState<string[]>([])
  const [cameraStatus, setCameraStatus] = useState<CameraLifecycleStatus>('loading')
  const [sampleCount, setSampleCount] = useState(0)
  const [fallbackAnswers, setFallbackAnswers] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<ResultOutcome | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const movement = MOVEMENTS[movementIndex]

  useEffect(() => {
    if (!assessmentIdRef.current || stage === 'result') return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  function toggleSafety(value: string) {
    setSafetySignals(values => values.includes(value) ? values.filter(item => item !== value) : [...values, value])
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
        setStage('setup')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your check-in.')
    } finally {
      setSaving(false)
    }
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

  async function beginCapture() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await ensureAssessment()
      samplesRef.current = []
      lastSampleAtRef.current = 0
      setSampleCount(0)
      setCameraStatus('loading')
      setStage('capture')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start this assessment.')
    } finally {
      setSaving(false)
    }
  }

  const handlePoseResult = useCallback((result: PoseResult) => {
    const now = Date.now()
    if (now - lastSampleAtRef.current < 180 || !result.landmarks.length) return
    lastSampleAtRef.current = now
    samplesRef.current.push({
      capturedAt: now,
      bodyConfidence: result.bodyConfidence,
      landmarks: result.landmarks,
    })
    if (samplesRef.current.length > 90) samplesRef.current.shift()
    setSampleCount(samplesRef.current.length)
  }, [])

  async function finishMovement() {
    const assessmentId = assessmentIdRef.current
    if (!assessmentId || saving) return
    setSaving(true)
    setError(null)
    try {
      const derived = deriveMovementObservations(movement.key, samplesRef.current)
      if (derived.status === 'low_confidence') {
        const completion = buildAssessmentCompletion({
          outcome: 'low_confidence',
          overallConfidence: derived.overallConfidence,
        })
        const result = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
        assertSupabaseSuccess(result, 'Save low-confidence assessment')
        setOutcome('low_confidence')
        setStage('result')
        return
      }

      const rows = buildObservationInserts({
        assessmentId,
        userId,
        observations: derived.observations,
      })
      const observationResult = await supabaseRef.current.from('movement_observations').upsert(rows, {
        onConflict: 'assessment_id,movement_key,dimension,side,metric_key',
      })
      assertSupabaseSuccess(observationResult, 'Save movement observations')
      confidencesRef.current.push(derived.overallConfidence)

      if (movementIndex < MOVEMENTS.length - 1) {
        setMovementIndex(index => index + 1)
        setStage('setup')
        return
      }

      const overallConfidence = confidencesRef.current.reduce((total, value) => total + value, 0)
        / confidencesRef.current.length
      const completion = buildAssessmentCompletion({ outcome: 'completed', overallConfidence })
      const completionResult = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
      assertSupabaseSuccess(completionResult, 'Complete movement assessment')
      setOutcome('completed')
      setStage('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this movement.')
    } finally {
      setSaving(false)
    }
  }

  async function enterFallback() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const assessmentId = await ensureAssessment()
      const completion = buildAssessmentCompletion({ outcome: 'camera_unavailable' })
      const result = await supabaseRef.current.from('movement_assessments').update(completion).eq('id', assessmentId)
      assertSupabaseSuccess(result, 'Save camera-unavailable assessment')
      setStage('fallback')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save camera fallback.')
    } finally {
      setSaving(false)
    }
  }

  async function saveFallbackAnswer(value: string) {
    if (saving) return
    const next = { ...fallbackAnswers, [movement.key]: value }
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
      if (movementIndex < MOVEMENTS.length - 1) {
        setMovementIndex(index => index + 1)
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

  function restart() {
    assessmentIdRef.current = null
    confidencesRef.current = []
    samplesRef.current = []
    setMovementIndex(0)
    setSampleCount(0)
    setOutcome(null)
    setError(null)
    setStage('setup')
  }

  return (
    <main className="min-h-dvh bg-cream text-charcoal">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <header className="flex items-center justify-between px-5 pb-4 pt-12">
          <button type="button" onClick={exitAssessment} disabled={saving}
            className="inline-flex items-center gap-2 text-sm font-medium text-charcoal-mid disabled:opacity-50">
            <ArrowLeft size={17} aria-hidden="true" /> Exit
          </button>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sage-dark">Body assessment</p>
            {stage !== 'intro' && stage !== 'check_in' && stage !== 'result' && (
              <p className="mt-0.5 text-xs text-muted">Movement {movementIndex + 1} of {MOVEMENTS.length}</p>
            )}
          </div>
        </header>

        {stage === 'intro' && (
          <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-4">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/15 text-sage-dark">
                <Camera size={25} aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">Personal starting point</p>
              <h1 className="mt-2 font-serif text-4xl leading-tight">Meet your body where it is today.</h1>
              <p className="mt-4 text-base leading-relaxed text-charcoal-mid">
                Three simple, no-mat movements create a baseline that is compared only with you.
              </p>
              <div className="mt-7 grid gap-3">
                <InfoRow icon={<Clock3 size={18} />} title="About 2 minutes" detail="Move slowly in your comfortable range." />
                <InfoRow icon={<Camera size={18} />} title="Camera-supported" detail="You can continue with self-report if the camera is unavailable." />
                <InfoRow icon={<ShieldAlert size={18} />} title="Not a diagnosis" detail="Stop signals pause movement recommendations." />
              </div>
            </div>
            <button type="button" onClick={() => setStage('check_in')} className="btn-primary mt-8 w-full">
              Start assessment <ArrowRight size={17} aria-hidden="true" />
            </button>
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
                  <button key={value} type="button" onClick={() => setComfort(value)} aria-pressed={comfort === value}
                    aria-label={`${value} out of 5`}
                    className={`min-h-14 rounded-2xl border font-serif text-lg ${comfort === value
                      ? 'border-sage bg-sage text-white'
                      : 'border-border bg-white text-charcoal-mid'}`}>
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
                      className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-medium ${selected
                        ? 'border-rose-dark bg-white text-rose-dark'
                        : 'border-rose/20 bg-white/70 text-charcoal-mid'}`}>
                      {selected && <Check size={13} className="mr-1 inline" aria-hidden="true" />}{label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {error && <ErrorMessage message={error} />}
            <button type="button" onClick={saveCheckIn} disabled={comfort === null || saving}
              className="btn-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-45">
              {saving ? 'Saving…' : safetySignals.length ? 'Save and pause' : 'Continue to movements'}
            </button>
          </section>
        )}

        {stage === 'setup' && (
          <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-sage/15 px-3 py-1.5 text-xs font-semibold text-sage-dark">{movement.view}</span>
                <span className="text-xs text-muted">{movementIndex + 1} / {MOVEMENTS.length}</span>
              </div>
              <h1 className="mt-5 font-serif text-3xl">{movement.title}</h1>
              <p className="mt-3 text-base leading-relaxed text-charcoal-mid">{movement.instruction}</p>
              <div className="mt-7 rounded-3xl border border-sage/20 bg-white p-5 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-dark">When recording</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">{movement.cue}</p>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">Keep the device steady and make sure the named body areas stay visible.</p>
            </div>
            {error && <ErrorMessage message={error} />}
            <button type="button" onClick={beginCapture} disabled={saving} className="btn-primary mt-8 w-full">
              {saving ? 'Preparing…' : 'Open camera'} <Camera size={17} aria-hidden="true" />
            </button>
          </section>
        )}

        {stage === 'capture' && (
          <section className="relative flex flex-1 flex-col bg-charcoal text-white">
            <div className="relative min-h-[58dvh] flex-1 overflow-hidden">
              <PoseCamera
                onPoseResult={handlePoseResult}
                onCameraStatus={setCameraStatus}
                exerciseName={movement.exerciseName}
                formScoreSupported={false}
                fill
                overlayMode="minimal"
              />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-3xl bg-black/65 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-light">{movement.view}</p>
                <p className="mt-1 text-sm leading-relaxed text-white">{movement.cue}</p>
                <p className="mt-2 text-xs text-white/55">{sampleCount < 8 ? 'Hold your full body in frame…' : 'Enough movement captured — finish when ready.'}</p>
              </div>
            </div>
            <div className="bg-charcoal px-5 pb-8 pt-4">
              {cameraStatus === 'unavailable' ? (
                <div className="grid gap-2">
                  <button type="button" onClick={() => setStage('setup')} className="btn-secondary border-white/20 bg-white/10 text-white">
                    <RefreshCw size={16} aria-hidden="true" /> Retry camera
                  </button>
                  <button type="button" onClick={enterFallback} disabled={saving} className="btn-primary">
                    Continue with self-report
                  </button>
                </div>
              ) : (
                <button type="button" onClick={finishMovement} disabled={sampleCount < 8 || saving || cameraStatus !== 'ready'}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-45">
                  {saving ? 'Checking…' : 'Finish movement'}
                </button>
              )}
              {error && <ErrorMessage message={error} dark />}
            </div>
          </section>
        )}

        {stage === 'fallback' && (
          <section className="flex flex-1 flex-col justify-between px-5 pb-8 pt-4">
            <div>
              <span className="rounded-full bg-cream-dark px-3 py-1.5 text-xs font-semibold text-charcoal-mid">Self-report · {movementIndex + 1} of 3</span>
              <h1 className="mt-5 font-serif text-3xl">How did {movement.title.toLowerCase()} feel?</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">This is saved as context only. It will not create numeric Mobility or Movement control data.</p>
              <div className="mt-7 grid gap-3">
                {['Easy and comfortable', 'Limited or stiff', 'Uncomfortable — I stopped'].map(value => (
                  <button key={value} type="button" onClick={() => saveFallbackAnswer(value)} disabled={saving}
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
          <ResultView outcome={outcome} onRetry={restart} onDone={() => router.push('/home')} />
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

function ErrorMessage({ message, dark = false }: { message: string; dark?: boolean }) {
  return <p role="alert" className={`mt-4 text-sm font-medium ${dark ? 'text-rose-light' : 'text-rose-dark'}`}>{message}</p>
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
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${outcome === 'safety_hold' ? 'bg-rose/15 text-rose-dark' : 'bg-sage/15 text-sage-dark'}`}>
          {content.icon}
        </div>
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
