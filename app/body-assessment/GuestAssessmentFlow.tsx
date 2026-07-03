'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  HeartHandshake,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import { ChoiceCard } from '@/components/assessment/ChoiceCard'
import MovementAssessmentCapture from '@/components/assessment/MovementAssessmentCapture'
import {
  readGuestAssessment,
  screenAssessment,
  writeGuestAssessment,
  type AssessmentIntake,
  type AssessmentRoute,
  type GuestCaptureState,
  type IntakeSafetySignal,
} from '@/lib/assessmentIntake'

const GOALS = [
  ['ease_neck_shoulder_tension', 'Ease neck and shoulder tension'],
  ['support_lower_back_comfort', 'Make my lower back feel better'],
  ['reduce_sitting_stiffness', 'Reduce stiffness from sitting'],
  ['improve_mobility', 'Improve mobility'],
  ['build_core_strength', 'Build core strength'],
  ['build_movement_habit', 'Create a consistent movement habit'],
] as const

const FOCUS_REGIONS = [
  ['neck_shoulders', 'Neck and shoulders'],
  ['upper_back', 'Upper back'],
  ['lower_back', 'Lower back'],
  ['hips', 'Hips'],
  ['knees', 'Knees'],
  ['no_discomfort', 'No particular discomfort'],
] as const

const INJURY_REGIONS = FOCUS_REGIONS.filter(([value]) => value !== 'no_discomfort')

const SENSATIONS = [
  ['tight', 'Tight'],
  ['achy', 'Achy'],
  ['painful', 'Painful'],
  ['numb_or_radiating', 'Numb or radiating'],
] as const

const HABITS = [
  ['rarely', 'Rarely'],
  ['weekly_1', 'Once per week'],
  ['weekly_2_3', 'Two to three times per week'],
  ['weekly_4_plus', 'Four or more times per week'],
] as const

const WORK_PATTERNS = [
  ['sitting_under_4h', 'Sitting under four hours'],
  ['sitting_4_8h', 'Sitting four to eight hours'],
  ['sitting_over_8h', 'Sitting over eight hours'],
  ['mostly_moving', 'Mostly standing or moving'],
] as const

const SAFETY_OPTIONS: Array<[IntakeSafetySignal, string]> = [
  ['sharp_pain', 'Worsening or sharp pain'],
  ['radiating_pain', 'Numbness or radiating symptoms'],
  ['dizziness', 'Dizziness'],
  ['professional_pause', 'A professional told me to pause exercise'],
]

const INITIAL_INTAKE: AssessmentIntake = {
  version: 1,
  goals: [],
  focusRegions: [],
  sensation: 'none',
  injuryStatus: 'none',
  injuryRegions: [],
  movementFrequency: 'rarely',
  workPattern: 'sitting_under_4h',
  availableMinutes: 5,
  safetySignals: [],
}

type InjuryChoice = 'none' | 'previous' | 'current'

function stageLabel(step: number) {
  if (step <= 3) return 'Get to know you'
  if (step <= 7) return 'Prepare assessment'
  return 'Build report'
}

export default function GuestAssessmentFlow() {
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(0)
  const [consented, setConsented] = useState(false)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [intake, setIntake] = useState<AssessmentIntake>(INITIAL_INTAKE)
  const [route, setRoute] = useState<AssessmentRoute>(() => screenAssessment(INITIAL_INTAKE))
  const [capture, setCapture] = useState<GuestCaptureState | null>(null)
  const [injuryChoice, setInjuryChoice] = useState<InjuryChoice | null>(null)
  const [movementFrequency, setMovementFrequency] = useState<AssessmentIntake['movementFrequency'] | null>(null)
  const [workPattern, setWorkPattern] = useState<AssessmentIntake['workPattern'] | null>(null)
  const [availableMinutes, setAvailableMinutes] = useState<AssessmentIntake['availableMinutes'] | null>(null)
  const [safetyApplies, setSafetyApplies] = useState<boolean | null>(null)

  useEffect(() => {
    const saved = readGuestAssessment(window.sessionStorage)
    if (saved) {
      setCreatedAt(saved.createdAt)
      setIntake(saved.intake)
      setRoute(saved.route)
      setCapture(saved.capture)
      setConsented(true)
      setInjuryChoice(saved.intake.injuryStatus === 'none'
        ? 'none'
        : saved.intake.injuryStatus === 'recovered' ? 'previous' : 'current')
      setMovementFrequency(saved.intake.movementFrequency)
      setWorkPattern(saved.intake.workPattern)
      setAvailableMinutes(saved.intake.availableMinutes)
      setSafetyApplies(saved.lastCompletedStep >= 7 ? saved.intake.safetySignals.length > 0 : null)
      setStep(saved.capture ? 9 : Math.min(saved.lastCompletedStep + 1, 8))
    }
    setHydrated(true)
  }, [])

  function persist(
    nextIntake: AssessmentIntake,
    lastCompletedStep: number,
    nextRoute?: AssessmentRoute,
    nextCapture: GuestCaptureState | null = capture,
  ) {
    const timestamp = createdAt ?? new Date().toISOString()
    const screened = nextRoute ?? screenAssessment(nextIntake)
    if (!createdAt) setCreatedAt(timestamp)
    setIntake(nextIntake)
    setRoute(screened)
    writeGuestAssessment(window.sessionStorage, {
      schemaVersion: 1,
      createdAt: timestamp,
      consentVersion: '2026-07-02',
      lastCompletedStep,
      intake: nextIntake,
      route: screened,
      capture: nextCapture,
    })
  }

  function completeStep(nextIntake: AssessmentIntake, completedStep: number) {
    persist(nextIntake, completedStep)
    setStep(completedStep + 1)
  }

  function toggleGoal(value: string) {
    setIntake(current => {
      const selected = current.goals
      if (!selected.includes(value) && selected.length >= 2) return current
      return {
        ...current,
        goals: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value],
      }
    })
  }

  function toggleFocus(value: string) {
    setIntake(current => {
      if (value === 'no_discomfort') {
        return { ...current, focusRegions: ['no_discomfort'], sensation: 'none' }
      }
      const withoutNone = current.focusRegions.filter(item => item !== 'no_discomfort')
      const focusRegions = withoutNone.includes(value)
        ? withoutNone.filter(item => item !== value)
        : [...withoutNone, value]
      return { ...current, focusRegions, sensation: focusRegions.length ? current.sensation : 'none' }
    })
  }

  function selectInjuryChoice(value: InjuryChoice) {
    setInjuryChoice(value)
    setIntake(current => ({
      ...current,
      injuryStatus: value === 'none' ? 'none' : value === 'previous' ? 'recovered' : 'occasional',
      injuryRegions: value === 'none' ? [] : current.injuryRegions,
    }))
  }

  function toggleInjuryRegion(value: string) {
    setIntake(current => ({
      ...current,
      injuryRegions: current.injuryRegions.includes(value)
        ? current.injuryRegions.filter(item => item !== value)
        : [...current.injuryRegions, value],
    }))
  }

  function toggleSafety(value: IntakeSafetySignal) {
    setIntake(current => ({
      ...current,
      safetySignals: current.safetySignals.includes(value)
        ? current.safetySignals.filter(item => item !== value)
        : [...current.safetySignals, value],
    }))
  }

  function finishScreening() {
    const nextIntake = safetyApplies ? intake : { ...intake, safetySignals: [] }
    const nextRoute = screenAssessment(nextIntake)
    persist(nextIntake, 7, nextRoute)
    setStep(8)
  }

  function finishCapture(nextCapture: GuestCaptureState) {
    setCapture(nextCapture)
    persist(intake, 7, route, nextCapture)
    setStep(9)
  }

  if (!hydrated) {
    return <main className="min-h-dvh bg-cream" aria-label="Loading body assessment" />
  }

  const canContinueFocus = intake.focusRegions.length > 0
    && (intake.focusRegions.includes('no_discomfort') || intake.sensation !== 'none')
  const canContinueInjury = injuryChoice === 'none'
    || (injuryChoice !== null && intake.injuryRegions.length > 0)
  const canFinishSafety = safetyApplies === false
    || (safetyApplies === true && intake.safetySignals.length > 0)

  return (
    <main className="min-h-dvh bg-cream text-charcoal">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {!(step === 8 && route.mode !== 'stop') && <header className="px-5 pb-4 pt-6 sm:pt-10">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-medium text-charcoal-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage">
              <ArrowLeft size={17} aria-hidden="true" /> Exit
            </Link>
            <div className="font-serif text-xl font-medium">Forma<span className="text-sage">.</span></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`Current stage: ${stageLabel(step)}`}>
            {['Get to know you', 'Prepare assessment', 'Build report'].map((label, index) => {
              const activeIndex = step <= 3 ? 0 : step <= 7 ? 1 : 2
              return (
                <div key={label}>
                  <div className={`h-1 rounded-full ${index <= activeIndex ? 'bg-sage' : 'bg-border'}`} />
                  <p className={`mt-1.5 text-[10px] font-semibold ${index === activeIndex ? 'text-sage-dark' : 'text-muted'}`}>{label}</p>
                </div>
              )
            })}
          </div>
        </header>}

        {step === 0 && (
          <AssessmentScreen eyebrow="Free body assessment" title="Learn what kind of movement fits your body today." intro="In about four minutes, combine your body context with three simple movements — no typing required.">
            <div className="mt-6 rounded-3xl bg-sage-dark p-5 text-white shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-light">Before we begin</p>
              <div className="mt-4 grid gap-4">
                <PrivacyRow icon={<Camera size={18} />} text="Raw camera video is not stored. Only derived observations can be saved after you create an account." />
                <PrivacyRow icon={<FileText size={18} />} text="Your answers stay in this browser session until you choose to save them." />
                <PrivacyRow icon={<HeartHandshake size={18} />} text="Forma observes movement; it does not provide a medical diagnosis." />
                <PrivacyRow icon={<ShieldCheck size={18} />} text="You can stop at any time and later view, export, or delete saved data." />
              </div>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-white p-4 text-sm leading-relaxed">
              <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} className="mt-0.5 h-5 w-5 accent-sage" />
              <span>I understand and agree to use my answers and camera-derived movement observations for this assessment.</span>
            </label>
            <StickyAction disabled={!consented} onClick={() => completeStep(intake, 0)}>Start my free body assessment</StickyAction>
          </AssessmentScreen>
        )}

        {step === 1 && (
          <AssessmentScreen eyebrow="6 quick choices · about 45 seconds · no typing required" title="What would feel most useful right now?" intro="Choose up to two. Your priorities guide the movement plan.">
            <ChoiceList>{GOALS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={intake.goals.includes(value)} onClick={() => toggleGoal(value)} />)}</ChoiceList>
            <StickyAction disabled={intake.goals.length === 0} onClick={() => completeStep(intake, 1)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 2 && (
          <AssessmentScreen eyebrow="Your body today" title="Where would you like more ease?" intro="Choose every area that feels relevant.">
            <ChoiceList>{FOCUS_REGIONS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={intake.focusRegions.includes(value)} onClick={() => toggleFocus(value)} />)}</ChoiceList>
            {!intake.focusRegions.includes('no_discomfort') && intake.focusRegions.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold">Which word fits best?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SENSATIONS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={intake.sensation === value} onClick={() => setIntake(current => ({ ...current, sensation: value }))} />)}
                </div>
              </div>
            )}
            <StickyAction disabled={!canContinueFocus} onClick={() => completeStep(intake, 2)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 3 && (
          <AssessmentScreen eyebrow="Movement context" title="Has an injury affected how you move?" intro="A previous injury can modify a movement without stopping your assessment.">
            <ChoiceList>
              <ChoiceCard title="No" selected={injuryChoice === 'none'} onClick={() => selectInjuryChoice('none')} />
              <ChoiceCard title="Previously, but recovered" selected={injuryChoice === 'previous'} onClick={() => selectInjuryChoice('previous')} />
              <ChoiceCard title="It still affects movement" selected={injuryChoice === 'current'} onClick={() => selectInjuryChoice('current')} />
            </ChoiceList>
            {injuryChoice && injuryChoice !== 'none' && (
              <div className="mt-6">
                <p className="text-sm font-semibold">Which area?</p>
                <div className="mt-3 grid gap-2">{INJURY_REGIONS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={intake.injuryRegions.includes(value)} onClick={() => toggleInjuryRegion(value)} />)}</div>
                {injuryChoice === 'current' && (
                  <div className="mt-5 grid gap-2">
                    <ChoiceCard title="Occasionally noticeable" selected={intake.injuryStatus === 'occasional'} onClick={() => setIntake(current => ({ ...current, injuryStatus: 'occasional' }))} />
                    <ChoiceCard title="Still in treatment or recovery" selected={intake.injuryStatus === 'recovering'} onClick={() => setIntake(current => ({ ...current, injuryStatus: 'recovering' }))} />
                  </div>
                )}
              </div>
            )}
            <StickyAction disabled={!canContinueInjury} onClick={() => completeStep(intake, 3)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 4 && (
          <AssessmentScreen eyebrow="Everyday movement" title="How often do you move on purpose?" intro="Think walks, mobility work, Pilates, strength, or anything similar.">
            <ChoiceList>{HABITS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={movementFrequency === value} onClick={() => { setMovementFrequency(value); setIntake(current => ({ ...current, movementFrequency: value })) }} />)}</ChoiceList>
            <StickyAction disabled={!movementFrequency} onClick={() => completeStep(intake, 4)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 5 && (
          <AssessmentScreen eyebrow="Your workday" title="How much of your day is spent sitting?" intro="This helps connect the movement observation to your daily context.">
            <ChoiceList>{WORK_PATTERNS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={workPattern === value} onClick={() => { setWorkPattern(value); setIntake(current => ({ ...current, workPattern: value })) }} />)}</ChoiceList>
            <StickyAction disabled={!workPattern} onClick={() => completeStep(intake, 5)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 6 && (
          <AssessmentScreen eyebrow="Make it fit" title="How much time can movement realistically get?" intro="Choose the option that would work on a normal day.">
            <ChoiceList>{([5, 15, 30] as const).map(value => <ChoiceCard key={value} title={`${value} minutes`} selected={availableMinutes === value} onClick={() => { setAvailableMinutes(value); setIntake(current => ({ ...current, availableMinutes: value })) }} />)}</ChoiceList>
            <StickyAction disabled={!availableMinutes} onClick={() => completeStep(intake, 6)}>Continue</StickyAction>
          </AssessmentScreen>
        )}

        {step === 7 && (
          <AssessmentScreen eyebrow="Safety check" title="Does any of this apply right now?" intro="Current signals determine whether movement should pause. An old injury by itself does not.">
            <ChoiceList>
              <ChoiceCard title="None of these" selected={safetyApplies === false} onClick={() => { setSafetyApplies(false); setIntake(current => ({ ...current, safetySignals: [] })) }} />
              <ChoiceCard title="One or more applies" selected={safetyApplies === true} onClick={() => setSafetyApplies(true)} />
            </ChoiceList>
            {safetyApplies && (
              <div className="mt-6 rounded-3xl border border-rose/25 bg-rose/10 p-4">
                <p className="text-sm font-semibold">Select what applies</p>
                <div className="mt-3 grid gap-2">{SAFETY_OPTIONS.map(([value, label]) => <ChoiceCard key={value} title={label} selected={intake.safetySignals.includes(value)} onClick={() => toggleSafety(value)} />)}</div>
              </div>
            )}
            <StickyAction disabled={!canFinishSafety} onClick={finishScreening}>Check my assessment route</StickyAction>
          </AssessmentScreen>
        )}

        {step === 8 && route.mode === 'stop' && (
          <AssessmentScreen eyebrow="Safety comes first" title="Pause the movement assessment for now." intro="Your current answers include a signal that needs a more cautious next step.">
            <div className="mt-7 rounded-3xl border border-rose/30 bg-white p-5 shadow-card">
              <HeartHandshake className="text-rose-dark" size={26} aria-hidden="true" />
              <h2 className="mt-4 font-serif text-xl">Keep this simple and conservative.</h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">Do not continue with the camera movements today. If symptoms are severe, new, or worsening, seek appropriate professional care. You can return and check again when the signal no longer applies.</p>
            </div>
            <Link href="/" className="btn-primary mt-8 w-full">Return to Forma</Link>
          </AssessmentScreen>
        )}

        {step === 8 && route.mode !== 'stop' && (
          <MovementAssessmentCapture
            constraints={route.constraints}
            onComplete={result => finishCapture({
              status: 'completed',
              observations: result.observations,
              overallConfidence: result.overallConfidence,
              completedAt: new Date().toISOString(),
            })}
            onLowConfidence={result => finishCapture({
              status: 'low_confidence',
              observations: [],
              overallConfidence: result.overallConfidence,
              reason: result.reason,
              completedAt: new Date().toISOString(),
            })}
            onCameraUnavailable={() => finishCapture({
              status: 'camera_unavailable',
              observations: [],
              overallConfidence: null,
              completedAt: new Date().toISOString(),
            })}
            onExit={() => { window.location.href = '/' }}
          />
        )}

        {step === 9 && capture?.status === 'completed' && (
          <AssessmentScreen eyebrow="Build report" title="Your clearest movement observation is ready." intro="Forma has kept only normalized movement evidence in this browser session. Your first insight comes next.">
            <div className="mt-7 rounded-3xl bg-sage-dark p-5 text-white shadow-soft">
              <CheckCircle2 size={28} className="text-sage-light" aria-hidden="true" />
              <h2 className="mt-4 font-serif text-xl">Camera check complete</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">Reliable observations: {capture.observations.length}. No raw video was retained.</p>
            </div>
            <Link href="/body-assessment/insight" className="btn-primary mt-8 w-full">View my first insight</Link>
          </AssessmentScreen>
        )}

        {step === 9 && capture?.status !== 'completed' && (
          <AssessmentScreen eyebrow="Build report" title="We need a clearer camera read." intro="No numeric movement insight was created from this attempt. Your answers remain available in this browser session.">
            <div className="mt-7 rounded-3xl border border-sage/20 bg-white p-5 shadow-card">
              <RefreshCw size={26} className="text-sage-dark" aria-hidden="true" />
              <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">Try again with your full body visible and steady lighting when you are ready.</p>
            </div>
            <button type="button" onClick={() => { setCapture(null); persist(intake, 7, route, null); setStep(8) }} className="btn-primary mt-8 w-full">Try camera again</button>
          </AssessmentScreen>
        )}
      </div>
    </main>
  )
}

function AssessmentScreen({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-dark">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-[2rem] leading-[1.18] text-charcoal">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">{intro}</p>
        {children}
      </div>
    </section>
  )
}

function ChoiceList({ children }: { children: React.ReactNode }) {
  return <div className="mt-7 grid gap-2.5">{children}</div>
}

function StickyAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="sticky bottom-0 -mx-1 mt-8 bg-gradient-to-t from-cream via-cream to-transparent px-1 pb-1 pt-6">
      <button type="button" disabled={disabled} onClick={onClick} className="btn-primary min-h-14 w-full text-base disabled:cursor-not-allowed disabled:opacity-45">
        {children} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  )
}

function PrivacyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex gap-3 text-sm leading-relaxed text-white/80">
      <span className="mt-0.5 text-sage-light">{icon}</span>
      <span>{text}</span>
    </div>
  )
}
