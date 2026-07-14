'use client'

import { useMemo, useState } from 'react'

import {
  deriveExerciseMissionState,
  type ExerciseMissionCountEvidence,
  type ExerciseMissionPhase,
  type ExerciseMissionPoseSnapshot,
  type ExerciseMissionQuickAction,
} from '@/lib/internalTesting/exerciseMission'
import type { TestScenario } from '@/lib/internalTesting/scenarios'
import type { TestableMovement } from '@/lib/internalTesting/types'
import type { ProductionRepCounterView } from '@/lib/repCounting/useProductionRepCounter'

const QUICK_ACTIONS: { action: ExerciseMissionQuickAction; label: string }[] = [
  { action: 'camera-placement', label: 'Camera placement' },
  { action: 'calibration-stuck', label: 'Calibration stuck' },
  { action: 'count-missed', label: 'Count missed' },
  { action: 'false-count', label: 'False count' },
  { action: 'tracking-flicker', label: 'Tracking flicker' },
]

function stateClass(state: string) {
  if (state === 'done') return 'border-emerald-300/50 bg-emerald-300/[0.15] text-emerald-50'
  if (state === 'active') return 'border-amber-300/50 bg-amber-300/[0.15] text-amber-50'
  if (state === 'warn') return 'border-rose-300/50 bg-rose-300/[0.15] text-rose-50'
  return 'border-white/10 bg-white/[0.05] text-white/55'
}

export function ExerciseMissionPanel({
  movement,
  scenario,
  currentPhase,
  pose,
  counter,
  countEvidence,
  onQuickAction,
  onCountObserved,
}: {
  movement: TestableMovement
  scenario: TestScenario
  currentPhase: ExerciseMissionPhase
  pose: ExerciseMissionPoseSnapshot | null
  counter?: ProductionRepCounterView
  countEvidence?: ExerciseMissionCountEvidence
  onQuickAction(action: ExerciseMissionQuickAction, evidence?: ExerciseMissionCountEvidence): Promise<void> | void
  onCountObserved(count: number, evidence?: ExerciseMissionCountEvidence): Promise<void> | void
}) {
  const [observedCount, setObservedCount] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const mission = useMemo(
    () => deriveExerciseMissionState({ movement, phase: currentPhase, repeats: scenario.repeats, pose }),
    [currentPhase, movement, pose, scenario.repeats],
  )

  async function run(action: () => Promise<void> | void, message: string) {
    setNotice('Saving internal annotation…')
    try {
      await action()
      setNotice(message)
    } catch (error) {
      setNotice(`Could not save annotation: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  function countDiagnosticEvidence(): ExerciseMissionCountEvidence {
    return {
      ...countEvidence,
      aiRepCount: counter?.repCount ?? null,
      targetReps: scenario.repeats,
      aiRepPhase: counter?.phase ?? null,
      aiStatus: counter?.status.chip ?? null,
      aiStatusMessage: counter?.status.message ?? null,
      cycleStage: counter?.cycleStage ?? null,
      movementStale: counter?.movementStale ?? null,
      qualityCue: counter?.qualityCue ?? null,
      visibleLandmarks: counter?.diagnostics.visible ?? pose?.visibleLandmarks ?? null,
      requiredLandmarks: counter?.diagnostics.required ?? null,
      trackedLandmarks: pose?.trackedLandmarks ?? null,
      bodyConfidence: counter?.diagnostics.confidence ?? pose?.bodyConfidence ?? null,
      delta: counter?.diagnostics.delta ?? null,
    }
  }

  function logCount() {
    const nextCount = observedCount + 1
    setObservedCount(nextCount)
    void run(() => onCountObserved(nextCount, countDiagnosticEvidence()), `Observed count ${nextCount} logged.`)
  }

  function checklistLabel(item: { key: string; label: string }) {
    if (item.key === 'count' && counter) return `${item.label} · AI ${counter.repCount}/${scenario.repeats}`
    return item.label
  }

  return (
    <section className="pointer-events-auto fixed left-3 top-3 z-[90] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border border-white/[0.15] bg-slate-950/[0.88] text-white shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(122,158,142,0.45),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sage-light">QA mission</p>
            <h2 className="mt-1 font-serif text-xl leading-tight">{movement.displayName}</h2>
          </div>
          <div className="rounded-full border border-white/[0.15] bg-black/25 px-3 py-1 text-[11px] uppercase tracking-wider text-white/70">
            {currentPhase}
          </div>
        </div>
        <p className="mt-3 text-sm text-white/[0.78]">{mission.headline}</p>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-[7rem_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{mission.primaryMetric.label}</p>
            <p className="mt-1 text-lg font-semibold">{mission.primaryMetric.value}</p>
          </div>
          <p className="text-xs leading-relaxed text-white/65">{mission.guidance}</p>
        </div>

        <div className="grid gap-2">
          {mission.checklist.map(item => (
            <div key={item.key} className={`rounded-xl border px-3 py-2 text-xs ${stateClass(item.state)}`}>
              {checklistLabel(item)}
            </div>
          ))}
        </div>

        {pose && (
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-white/60">
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.visibleLandmarks}</span>visible</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.trackedLandmarks}</span>tracked</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{Math.round(pose.bodyConfidence * 100)}%</span>body</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.detectionFps}</span>fps</div>
          </div>
        )}

        {currentPhase === 'exercising' && counter && (
          <div className="rounded-2xl border border-sage-light/25 bg-sage-light/[0.08] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">AI count</p>
                <p className="mt-1 text-2xl font-semibold text-white">{counter.repCount}<span className="text-sm text-white/45"> / {scenario.repeats}</span></p>
              </div>
              <div className="rounded-full bg-black/30 px-3 py-1 text-xs text-sage-light">
                {counter.status.chip}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/60">{counter.status.message}</p>
            <div className="mt-3 grid grid-cols-4 gap-1" aria-label="Production rep cycle">
              {(['Start', 'Move', 'Return', 'Count'] as const).map(stage => (
                <div
                  key={stage}
                  className={`h-1.5 rounded-full ${counter.cycleStage === stage ? 'bg-sage-light' : 'bg-white/15'}`}
                  aria-label={stage}
                />
              ))}
            </div>
            {counter.repFlash && <p className="mt-2 text-xs font-semibold text-sage-light">+1 counted by production logic</p>}
            {counter.qualityCue && <p className="mt-2 text-xs text-sage-light">{counter.qualityCue}</p>}
          </div>
        )}

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!mission.canLogCameraSuccess}
              onClick={() => void run(() => onQuickAction('camera-pass'), 'Camera pass logged.')}
              className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Log camera passed
            </button>
            <button
              type="button"
              disabled={!mission.canLogCalibrationSuccess}
              onClick={() => void run(() => onQuickAction('calibration-pass'), 'Calibration pass logged.')}
              className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Log calibration passed
            </button>
            <button
              type="button"
              disabled={!mission.canLogCountSuccess}
              onClick={() => void run(() => onQuickAction('count-pass', countDiagnosticEvidence()), 'Count pass logged.')}
              className="rounded-xl bg-sage-light px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Log count passed
            </button>
          </div>
          {(currentPhase === 'exercising' || currentPhase === 'capture') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={logCount}
                className="rounded-xl bg-white/[0.09] px-3 py-2 text-xs font-semibold text-white/80"
              >
                + Count observed
              </button>
              <button
                type="button"
                onClick={() => void run(() => onQuickAction('ai-count-zero', countDiagnosticEvidence()), 'AI count zero evidence logged.')}
                className="rounded-xl bg-rose-300 px-3 py-2 text-xs font-semibold text-slate-950"
              >
                AI count stuck at 0
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(item => (
            <button
              key={item.action}
              type="button"
              onClick={() => void run(
                () => onQuickAction(item.action, item.action.startsWith('count') || item.action === 'false-count' || item.action === 'tracking-flicker'
                  ? countDiagnosticEvidence()
                  : undefined),
                `${item.label} logged.`,
              )}
              className="rounded-full border border-white/[0.12] bg-white/[0.07] px-3 py-1.5 text-xs text-white/75 active:bg-white/[0.15]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {(notice || mission.guardrail) && (
          <p role="status" aria-live="polite" className="rounded-xl bg-black/25 p-2 text-[11px] leading-relaxed text-white/55">
            {notice ?? mission.guardrail}
          </p>
        )}
      </div>
    </section>
  )
}
