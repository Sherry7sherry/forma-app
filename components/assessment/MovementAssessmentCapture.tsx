'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, RefreshCw } from 'lucide-react'

import type { CameraLifecycleStatus, FramingStatus, PoseResult } from '@/components/camera/PoseCamera'
import {
  deriveMovementObservations,
  evaluateMovementEvidence,
  hasMovementCoverage,
  isNeutralRollDownBaseline,
  type AssessmentFailureReason,
  type MovementEvidence,
  type AssessmentPoseSample,
  type DerivedObservation,
} from '@/lib/bodyAssessment'
import type { AssessmentMovement, MovementConstraint } from '@/lib/assessmentIntake'
import { ASSESSMENT_TEST_MOVEMENTS } from '@/lib/internalTesting/movementRegistry'
import type { InternalAssessmentTestAdapter } from '@/lib/internalTesting/assessmentAdapter'
import { InternalTestOverlay } from '@/components/internalTesting/InternalTestOverlay'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

export interface MovementAssessmentCaptureProps {
  constraints: MovementConstraint[]
  onComplete(result: { observations: DerivedObservation[]; overallConfidence: number }): void
  onLowConfidence(result: { overallConfidence: number; reason: AssessmentFailureReason }): void
  onCameraUnavailable(): void
  onExit(): void
  internalTestAdapter?: InternalAssessmentTestAdapter
}

export const MOVEMENT_ASSESSMENT_ITEMS = ASSESSMENT_TEST_MOVEMENTS.map(entry => ({
  ...entry,
  key: entry.assessmentMovementKey,
}))

const EMPTY_EVIDENCE: MovementEvidence = {
  ready: false,
  validSampleCount: 0,
  totalSampleCount: 0,
  validSampleRatio: 0,
  reason: 'insufficient_samples',
}
const CALIBRATION_FRAMES = 3

function hasConstraint(
  constraints: MovementConstraint[],
  movement: AssessmentMovement,
  kind: MovementConstraint['kind'],
) {
  return constraints.some(item => item.kind === kind && item.movement === movement)
}

export default function MovementAssessmentCapture({
  constraints,
  onComplete,
  onLowConfidence,
  onCameraUnavailable,
  onExit,
  internalTestAdapter,
}: MovementAssessmentCaptureProps) {
  const movements = useMemo(() => MOVEMENT_ASSESSMENT_ITEMS.filter(item =>
    !hasConstraint(constraints, item.key, 'skip_movement')), [constraints])
  const samplesRef = useRef<AssessmentPoseSample[]>([])
  const observationsRef = useRef<DerivedObservation[]>([])
  const confidencesRef = useRef<number[]>([])
  const lastSampleAtRef = useRef(0)
  const stableFullBodyFramesRef = useRef(0)
  const stableBaselineFramesRef = useRef(0)
  const [movementIndex, setMovementIndex] = useState(0)
  const [stage, setStage] = useState<'setup' | 'capture'>('setup')
  const [cameraStatus, setCameraStatus] = useState<CameraLifecycleStatus>('loading')
  const [framingStatus, setFramingStatus] = useState<FramingStatus>('no-body')
  const [deviceClass, setDeviceClass] = useState<PoseResult['diagnostics']['deviceClass']>('desktop')
  const [guidanceSide, setGuidanceSide] = useState<'left' | 'right'>('right')
  const [calibrated, setCalibrated] = useState(false)
  const [baselineReady, setBaselineReady] = useState(false)
  const [baselineFrameCount, setBaselineFrameCount] = useState(0)
  const [evidence, setEvidence] = useState<MovementEvidence>(EMPTY_EVIDENCE)
  const [checking, setChecking] = useState(false)
  const [singleArmCompare, setSingleArmCompare] = useState(false)

  const movement = movements[movementIndex]
  const reducedRange = movement && hasConstraint(constraints, movement.key, 'reduce_range')
  const canCompareOneArm = movement?.key === 'side_arm_raise'
    && hasConstraint(constraints, movement.key, 'optional_single_arm_compare')

  const handlePoseResult = useCallback((result: PoseResult) => {
    setFramingStatus(result.framingStatus)
    setDeviceClass(result.diagnostics.deviceClass)
    if (result.landmarks.length > 24) {
      const torsoCenter = [11, 12, 23, 24]
        .reduce((sum, index) => sum + (result.landmarks[index]?.x ?? 0.5), 0) / 4
      setGuidanceSide(torsoCenter < 0.5 ? 'left' : 'right')
    }
    const now = Date.now()
    if (now - lastSampleAtRef.current < 180 || !result.landmarks.length) return
    lastSampleAtRef.current = now

    if (!calibrated) {
      const movementCalibrationReady = movement?.key === 'seated_trunk_rotation'
        ? result.framingStatus === 'full-body'
          && hasMovementCoverage(movement.key, {
            capturedAt: now, bodyConfidence: result.bodyConfidence, landmarks: result.landmarks,
          })
        : result.framingStatus === 'full-body' && result.bodyConfidence >= 0.65
      if (movementCalibrationReady) {
        stableFullBodyFramesRef.current += 1
        if (stableFullBodyFramesRef.current >= CALIBRATION_FRAMES) {
          setCalibrated(true)
          const needsBaseline = movement?.key === 'standing_roll_down'
          setBaselineReady(!needsBaseline)
          if (needsBaseline) setEvidence({ ...EMPTY_EVIDENCE, reason: 'baseline_missing' })
        }
      } else {
        stableFullBodyFramesRef.current = 0
      }
      return
    }

    const nextSample: AssessmentPoseSample = {
      capturedAt: now,
      bodyConfidence: result.bodyConfidence,
      landmarks: result.landmarks,
      phase: 'movement',
    }

    if (movement?.key === 'standing_roll_down' && !baselineReady) {
      const baselineSample = { ...nextSample, phase: 'baseline' as const }
      if (!hasMovementCoverage(movement.key, baselineSample)) {
        samplesRef.current = samplesRef.current.filter(sample => sample.phase !== 'baseline')
        stableBaselineFramesRef.current = 0
        setBaselineFrameCount(0)
        setEvidence({ ...EMPTY_EVIDENCE, reason: 'landmarks' })
        return
      }
      if (!isNeutralRollDownBaseline(baselineSample)) {
        samplesRef.current = samplesRef.current.filter(sample => sample.phase !== 'baseline')
        stableBaselineFramesRef.current = 0
        setBaselineFrameCount(0)
        setEvidence({ ...EMPTY_EVIDENCE, reason: 'baseline_missing' })
        return
      }
      samplesRef.current.push(baselineSample)
      stableBaselineFramesRef.current += 1
      setBaselineFrameCount(stableBaselineFramesRef.current)
      setEvidence({ ...EMPTY_EVIDENCE, totalSampleCount: samplesRef.current.length, reason: 'baseline_missing' })
      if (stableBaselineFramesRef.current >= 3) {
        setBaselineReady(true)
        setEvidence({ ...EMPTY_EVIDENCE, totalSampleCount: samplesRef.current.length })
      }
      return
    }

    samplesRef.current.push(nextSample)
    if (samplesRef.current.length > 90) {
      const oldestMovementIndex = samplesRef.current.findIndex(sample => sample.phase !== 'baseline')
      if (oldestMovementIndex >= 0) samplesRef.current.splice(oldestMovementIndex, 1)
    }
    if (movement) setEvidence(evaluateMovementEvidence(movement.key, samplesRef.current))
  }, [baselineReady, calibrated, movement])

  function resetCaptureState() {
    samplesRef.current = []
    lastSampleAtRef.current = 0
    stableFullBodyFramesRef.current = 0
    stableBaselineFramesRef.current = 0
    setCalibrated(false)
    setBaselineReady(false)
    setBaselineFrameCount(0)
    setEvidence(EMPTY_EVIDENCE)
    setFramingStatus('no-body')
    setGuidanceSide('right')
  }

  function openCamera() {
    resetCaptureState()
    setCameraStatus('loading')
    setStage('capture')
  }

  function finishMovement() {
    if (!movement || checking) return
    setChecking(true)
    const derived = deriveMovementObservations(movement.key, samplesRef.current)
    if (derived.status === 'low_confidence') {
      onLowConfidence({
        overallConfidence: derived.overallConfidence,
        reason: derived.reason,
      })
      setChecking(false)
      return
    }

    const allObservations = [...observationsRef.current, ...derived.observations]
    const allConfidences = [...confidencesRef.current, derived.overallConfidence]
    if (movementIndex === movements.length - 1) {
      onComplete({
        observations: allObservations,
        overallConfidence: allConfidences.reduce((sum, value) => sum + value, 0) / allConfidences.length,
      })
      setChecking(false)
      return
    }

    observationsRef.current = allObservations
    confidencesRef.current = allConfidences
    setMovementIndex(index => index + 1)
    setSingleArmCompare(false)
    setChecking(false)
    resetCaptureState()
    setStage('setup')
  }

  function forceContinue() {
    if (!movement || !internalTestAdapter) return
    internalTestAdapter.syntheticComplete(movement.id, 'tester-blocked')
    if (movementIndex === movements.length - 1) { internalTestAdapter.endCoverage(); onExit(); return }
    setMovementIndex(index => index + 1); resetCaptureState(); setStage('setup')
  }

  if (!movement) {
    return (
      <section className="flex min-h-dvh flex-col justify-center bg-cream px-5 text-center">
        <h1 className="font-serif text-3xl">No camera movements are available.</h1>
        <p className="mt-3 text-sm text-charcoal-mid">Your current movement constraints skip every assessment movement.</p>
        <button type="button" onClick={onExit} className="btn-primary mt-7">Exit assessment</button>
      </section>
    )
  }

  return (
    <section className={`flex min-h-dvh flex-col ${stage === 'capture' ? 'bg-charcoal text-white' : 'bg-cream text-charcoal'}`}>
      {internalTestAdapter && <InternalTestOverlay movement={movement.displayName} phase={stage} onRecord={issue=>internalTestAdapter.record({eventType:'blocker',data:{movementId:movement.id,issue}})} onRetry={()=>{internalTestAdapter.retry(stage);openCamera()}} onForceContinue={forceContinue} onEnd={()=>{internalTestAdapter.endCoverage();onExit()}} />}
      <header className="flex items-center justify-between px-5 pb-4 pt-6 sm:pt-10">
        <button type="button" onClick={onExit} className={`inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage ${stage === 'capture' ? 'text-white/75' : 'text-charcoal-mid'}`}>
          <ArrowLeft size={17} aria-hidden="true" /> Exit
        </button>
        <div className="text-right">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${stage === 'capture' ? 'text-sage-light' : 'text-sage-dark'}`}>Prepare assessment</p>
          <p className={`mt-0.5 text-xs ${stage === 'capture' ? 'text-white/50' : 'text-muted'}`}>Movement {movementIndex + 1} of {movements.length}</p>
        </div>
      </header>

      {stage === 'setup' && (
        <div className="flex flex-1 flex-col justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-sage/15 px-3 py-1.5 text-xs font-semibold text-sage-dark">{movement.view}</span>
              <span className="text-xs text-muted">No mat needed</span>
            </div>
            <h1 className="mt-5 font-serif text-3xl">{movement.title}</h1>
            <p className="mt-3 text-base leading-relaxed text-charcoal-mid">{movement.instruction}</p>
            <div className="mt-7 rounded-3xl border border-sage/20 bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-dark">When the camera opens</p>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">{movement.cue}</p>
              {reducedRange && (
                <p className="mt-3 rounded-2xl bg-cream-dark p-3 text-sm leading-relaxed text-charcoal-mid">
                  Use a smaller, comfortable range. There is no need to reach an end position.
                </p>
              )}
            </div>
            {canCompareOneArm && (
              <button type="button" aria-pressed={singleArmCompare} onClick={() => setSingleArmCompare(value => !value)}
                className={`mt-4 w-full rounded-2xl border p-4 text-left text-sm ${singleArmCompare ? 'border-sage bg-sage/10' : 'border-border bg-white'}`}>
                <span className="font-semibold">Optional single-arm comparison</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">After the regular reps, raise one arm at a time within a comfortable range.</span>
              </button>
            )}
          </div>
          <button type="button" onClick={openCamera} className="btn-primary mt-8 min-h-14 w-full text-base">
            Open camera <Camera size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {stage === 'capture' && (
        <div className="flex flex-1 flex-col">
          <div className="relative min-h-[58dvh] flex-1 overflow-hidden">
            <PoseCamera
              onPoseResult={handlePoseResult}
              onCameraStatus={setCameraStatus}
              exerciseName={movement.exerciseName}
              formScoreSupported={false}
              fill
              overlayMode="minimal"
              recoveryMode="external"
              posePrecision="assessment"
              framingRequirement={movement.key === 'seated_trunk_rotation' ? 'seated-torso' : 'full-body'}
            />
            <div className={`pointer-events-none absolute top-16 max-w-[260px] rounded-2xl bg-black/65 p-3 backdrop-blur-sm ${
              guidanceSide === 'left' ? 'left-3' : 'right-3'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-light">{movement.view}</p>
              <p className="mt-1 text-sm leading-relaxed text-white">
                {!calibrated ? movement.key === 'seated_trunk_rotation'
                  ? framingStatus === 'full-body'
                    ? 'Seated framing ready. Hold still while tracking stabilizes.'
                    : 'Keep both shoulders and hips clear, with your torso filling the frame.'
                  : framingStatus === 'full-body'
                  ? 'Hold still for a moment while tracking stabilizes.'
                  : deviceClass === 'phone'
                    ? 'Lower or tilt your phone downward. Keep your head and feet visible and fill more of the screen.'
                    : deviceClass === 'tablet'
                      ? 'Lower or tilt your tablet downward so your head and feet stay visible.'
                      : 'Tilt the screen or camera downward so your feet enter the frame. On a laptop, place it near hip height, about 2–3 m away.'
                  : movement.key === 'standing_roll_down' && !baselineReady
                    ? evidence.reason === 'landmarks'
                      ? 'Keep one wrist and ankle visible on the same side.'
                      : 'Stand tall and hold still before you begin.'
                    : movement.cue}
              </p>
              {calibrated && reducedRange && <p className="mt-1 text-xs text-sage-light">Stay inside your smaller comfortable range.</p>}
              {calibrated && singleArmCompare && <p className="mt-1 text-xs text-sage-light">Finish with the optional one-arm comparison.</p>}
              <p className="mt-2 text-xs text-white/55">
                {!calibrated
                  ? movement.key === 'seated_trunk_rotation'
                    ? framingStatus === 'full-body'
                      ? 'Calibrating seated torso… hold still for a moment.'
                      : 'Both shoulders and hips must remain visible; feet are not required.'
                    : framingStatus === 'full-body'
                      ? 'Calibrating… hold your full body steady in frame.'
                      : 'Head and feet must remain visible before movement capture starts.'
                  : movement.key === 'seated_trunk_rotation'
                    ? framingStatus !== 'full-body'
                      ? 'Both shoulders and hips must remain visible; feet are not required.'
                      : evidence.reason === 'landmarks'
                        ? 'Keep both shoulders and hips clear while rotating.'
                        : evidence.reason === 'range'
                          ? 'Complete a gentle turn to both sides, returning through center.'
                          : evidence.ready
                            ? 'Enough clear left-and-right rotation captured — finish when ready.'
                            : `Capturing seated rotation… ${evidence.validSampleCount} valid frames.`
                  : movement.key === 'standing_roll_down' && !baselineReady
                    ? evidence.reason === 'landmarks'
                      ? 'Tracking needs one clear near-side wrist, hip, and ankle.'
                      : `Capturing neutral baseline… ${baselineFrameCount}/3 stable frames.`
                  : evidence.ready
                    ? 'Enough clear movement captured — finish when ready.'
                    : evidence.reason === 'baseline_missing'
                      ? 'Stand tall and hold still before starting the movement.'
                    : evidence.reason === 'landmarks'
                      ? 'Keep one wrist and ankle visible while you move.'
                    : evidence.reason === 'range'
                      ? 'Keep going through the instructed comfortable movement.'
                      : `Capturing clear movement… ${evidence.validSampleCount} valid frames.`}
              </p>
            </div>
          </div>
          <div className="bg-charcoal px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
            {cameraStatus === 'unavailable' ? (
              <div className="grid gap-2">
                <button type="button" onClick={() => setStage('setup')} className="btn-secondary border-white/20 bg-white/10 text-white">
                  <RefreshCw size={16} aria-hidden="true" /> Retry camera
                </button>
                <button type="button" onClick={onCameraUnavailable} className="btn-primary">Continue without camera</button>
              </div>
            ) : (
              <button type="button" onClick={finishMovement} disabled={!evidence.ready || checking || cameraStatus !== 'ready'}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-45">
                {checking ? 'Checking…' : 'Finish movement'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
