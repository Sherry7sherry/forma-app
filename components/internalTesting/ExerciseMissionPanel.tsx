'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  canRecordCountPassFromAttempt,
  deriveExerciseMissionState,
  type ExerciseMissionCountEvidence,
  type ExerciseMissionPhase,
  type ExerciseMissionPoseSnapshot,
  type ExerciseMissionQuickAction,
} from '@/lib/internalTesting/exerciseMission'
import type { TestScenario } from '@/lib/internalTesting/scenarios'
import type { TestableMovement } from '@/lib/internalTesting/types'
import type { ProductionRepCounterView } from '@/lib/repCounting/useProductionRepCounter'
import { createVoiceCoach } from '@/lib/voiceCoach'

const QUICK_ACTIONS: { action: ExerciseMissionQuickAction; label: string }[] = [
  { action: 'camera-placement', label: 'Camera placement' },
  { action: 'calibration-stuck', label: 'Calibration stuck' },
  { action: 'count-missed', label: 'Count missed' },
  { action: 'false-count', label: 'False count' },
  { action: 'tracking-flicker', label: 'Tracking flicker' },
]

const PASS_BUTTON_CLASS = 'rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-white/[0.12] disabled:text-white/35 disabled:opacity-100'
const COUNT_PASS_BUTTON_CLASS = 'rounded-xl bg-sage-light px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-white/[0.12] disabled:text-white/35 disabled:opacity-100'
const FAIL_BUTTON_CLASS = 'rounded-xl border border-rose-300/35 bg-rose-300/[0.16] px-3 py-2 text-xs font-semibold text-rose-50 active:bg-rose-300/[0.24] disabled:cursor-not-allowed disabled:bg-white/[0.12] disabled:text-white/35 disabled:opacity-100'
const CAMERA_TIMEOUT_MS = 30_000
const CALIBRATION_TIMEOUT_MS = 30_000
const COUNT_ZERO_TIMEOUT_MS = 60_000
const PHASE_GUIDANCE_COOLDOWN_MS = 8_000
const PASS_CONFIRMATION_COOLDOWN_MS = 15_000

interface AttemptPoseSummary {
  sawBody: boolean
  bestVisibleLandmarks: number
  bestTrackedLandmarks: number
  bestBodyConfidence: number
  bestDetectionFps: number
  lastDetectedAt: number | null
}

interface VoiceFeedback {
  key: string
  text: string
}

const EMPTY_ATTEMPT_POSE_SUMMARY: AttemptPoseSummary = {
  sawBody: false,
  bestVisibleLandmarks: 0,
  bestTrackedLandmarks: 0,
  bestBodyConfidence: 0,
  bestDetectionFps: 0,
  lastDetectedAt: null,
}

function stateClass(state: string) {
  if (state === 'done') return 'border-emerald-300/50 bg-emerald-300/[0.15] text-emerald-50'
  if (state === 'active') return 'border-amber-300/50 bg-amber-300/[0.15] text-amber-50'
  if (state === 'warn') return 'border-rose-300/50 bg-rose-300/[0.15] text-rose-50'
  return 'border-white/10 bg-white/[0.05] text-white/55'
}

function hasNoBodyLandmarks(pose: ExerciseMissionPoseSnapshot | null) {
  return !pose || (pose.visibleLandmarks === 0 && pose.trackedLandmarks === 0)
}

function formatBodyParts(bodyParts: readonly string[]) {
  if (bodyParts.length === 0) return ''
  if (bodyParts.length === 1) return bodyParts[0]
  if (bodyParts.length === 2) return `${bodyParts[0]} and ${bodyParts[1]}`
  return `${bodyParts.slice(0, -1).join(', ')}, and ${bodyParts.at(-1)}`
}

function specificMissingBodyParts(pose: ExerciseMissionPoseSnapshot | null) {
  if (!pose || pose.visibleLandmarks === 0) return []
  return pose.missingBodyParts.slice(0, 3)
}

function specificMissingBodyPartCue(pose: ExerciseMissionPoseSnapshot | null) {
  const bodyParts = specificMissingBodyParts(pose)
  return bodyParts.length > 0 ? `Missing ${formatBodyParts(bodyParts)}.` : null
}

function specificPlacementInstruction(bodyParts: readonly string[]) {
  const missingLowerBody = bodyParts.some(part => /knee|ankle/.test(part))
  const missingUpperBody = bodyParts.some(part => /head|shoulder/.test(part))
  if (missingLowerBody && missingUpperBody) return 'Move the camera farther back so your full body fits.'
  if (missingLowerBody) return 'Tilt the camera down or move it farther back.'
  if (missingUpperBody) return 'Tilt the camera up or move it farther back.'
  return 'Center your body and improve the lighting on that area.'
}

function cameraGuidanceText(pose: ExerciseMissionPoseSnapshot | null) {
  if (!pose || pose.framingStatus === 'no-body' || hasNoBodyLandmarks(pose)) {
    return 'We need body landmarks, not just confidence. Move back or tilt the camera until your head, torso, hips, and feet are visible.'
  }
  const specificCue = specificMissingBodyPartCue(pose)
  if (specificCue) return `${specificCue} ${specificPlacementInstruction(specificMissingBodyParts(pose))}`
  if (pose.framingStatus === 'upper-body') {
    return 'Lower or tilt the camera down so your legs and feet are visible.'
  }
  if (pose.framingStatus === 'partial') {
    return 'Center your whole body in the frame and improve the lighting.'
  }
  return 'Keep your whole body centered while the camera locks body landmarks.'
}

function calibrationGuidanceText(pose: ExerciseMissionPoseSnapshot | null) {
  if (!pose || pose.framingStatus === 'no-body') {
    return 'I cannot calibrate yet. Bring your whole body back into the frame.'
  }
  const specificCue = specificMissingBodyPartCue(pose)
  if (specificCue) {
    return `${specificCue} ${specificPlacementInstruction(specificMissingBodyParts(pose))} Then hold your starting position.`
  }
  if (pose.bodyConfidence < 0.55) {
    return 'Hold your starting position and improve lighting so calibration can lock.'
  }
  return 'Keep the required body shape still and fully visible for calibration.'
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
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [attemptPoseSummary, setAttemptPoseSummary] = useState<AttemptPoseSummary>(EMPTY_ATTEMPT_POSE_SUMMARY)
  const [lastDetectedAgeMs, setLastDetectedAgeMs] = useState<number | null>(null)
  const voiceCoachRef = useRef(createVoiceCoach())
  const mission = useMemo(
    () => deriveExerciseMissionState({ movement, phase: currentPhase, repeats: scenario.repeats, pose }),
    [currentPhase, movement, pose, scenario.repeats],
  )
  const aiRepCount = counter?.repCount ?? null
  const countReadyForHumanConfirmation = canRecordCountPassFromAttempt({
    phase: currentPhase,
    countMode: mission.countMode,
    currentBodyReady: mission.canLogCountSuccess,
    attemptBodyReady: attemptHadCameraReady(),
    aiRepCount,
  })
  const cameraReadyForHumanConfirmation = currentPhase === 'camera'
    && (mission.canLogCameraSuccess || attemptHadCameraReady())
  const visibleMissingBodyParts = specificMissingBodyParts(pose)
  const showSpecificMissingBodyParts = visibleMissingBodyParts.length > 0
    && (
      (currentPhase === 'camera' && !cameraReadyForHumanConfirmation)
      || (currentPhase === 'calibrating' && !mission.canLogCalibrationSuccess)
    )

  useEffect(() => {
    setAttemptPoseSummary(EMPTY_ATTEMPT_POSE_SUMMARY)
    setLastDetectedAgeMs(null)
    setNotice(null)
    voiceCoachRef.current.reset()
  }, [currentPhase, movement.id])

  useEffect(() => {
    if (currentPhase === 'camera' && !cameraReadyForHumanConfirmation) {
      voiceCoachRef.current.speak({
        key: `camera-guidance-${pose?.framingStatus ?? 'missing'}`,
        text: cameraGuidanceText(pose),
        cooldownMs: PHASE_GUIDANCE_COOLDOWN_MS,
      }, true)
    }
  }, [cameraReadyForHumanConfirmation, currentPhase, pose])

  useEffect(() => {
    if (!cameraReadyForHumanConfirmation) return
    setNotice('Camera passed. Tap Log camera passed to confirm.')
    voiceCoachRef.current.speak({
      key: `camera-pass-ready-${movement.id}`,
      text: 'Camera passed. Please tap Log camera passed.',
      cooldownMs: PASS_CONFIRMATION_COOLDOWN_MS,
    }, true)
  }, [cameraReadyForHumanConfirmation, movement.id])

  useEffect(() => {
    if (currentPhase === 'calibrating' && !mission.canLogCalibrationSuccess) {
      voiceCoachRef.current.speak({
        key: `calibration-guidance-${pose?.framingStatus ?? 'missing'}`,
        text: calibrationGuidanceText(pose),
        cooldownMs: PHASE_GUIDANCE_COOLDOWN_MS,
      }, true)
    }
  }, [currentPhase, mission.canLogCalibrationSuccess, pose])

  useEffect(() => {
    if (currentPhase !== 'calibrating' || !mission.canLogCalibrationSuccess) return
    setNotice('Calibration passed. Tap Log calibration passed to confirm.')
    voiceCoachRef.current.speak({
      key: `calibration-pass-ready-${movement.id}`,
      text: 'Calibration passed. Please tap Log calibration passed.',
      cooldownMs: PASS_CONFIRMATION_COOLDOWN_MS,
    }, true)
  }, [currentPhase, mission.canLogCalibrationSuccess, movement.id])

  useEffect(() => {
    if (!countReadyForHumanConfirmation) return
    setNotice('Count is ready. Tap Log count passed to confirm.')
    voiceCoachRef.current.speak({
      key: `count-pass-ready-${movement.id}`,
      text: 'Count is ready. Please tap Log count passed.',
      cooldownMs: PASS_CONFIRMATION_COOLDOWN_MS,
    }, true)
  }, [countReadyForHumanConfirmation, movement.id])

  useEffect(() => {
    if (currentPhase !== 'camera' || cameraReadyForHumanConfirmation) return
    const timeoutId = window.setTimeout(() => {
      setNotice('Camera has not passed after 30s. Please log a camera issue.')
      voiceCoachRef.current.speak({
        key: `camera-timeout-${movement.id}`,
        text: 'Camera has not passed. Please log a camera issue.',
        cooldownMs: 0,
      }, true)
    }, CAMERA_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [cameraReadyForHumanConfirmation, currentPhase, movement.id])

  useEffect(() => {
    if (currentPhase !== 'calibrating' || mission.canLogCalibrationSuccess) return
    const timeoutId = window.setTimeout(() => {
      setNotice('Calibration has not passed after 30s. Please log a calibration issue.')
      voiceCoachRef.current.speak({
        key: `calibration-timeout-${movement.id}`,
        text: 'Calibration has not passed. Please log a calibration issue.',
        cooldownMs: 0,
      }, true)
    }, CALIBRATION_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [currentPhase, mission.canLogCalibrationSuccess, movement.id])

  useEffect(() => {
    if (currentPhase !== 'exercising' || mission.countMode !== 'automatic' || aiRepCount === null || aiRepCount > 0) return
    const timeoutId = window.setTimeout(() => {
      setNotice('AI count is still 0 after 1 minute. Please log a count issue.')
      voiceCoachRef.current.speak({
        key: `count-zero-timeout-${movement.id}`,
        text: 'AI count is still zero. Please log a count issue.',
        cooldownMs: 0,
      }, true)
    }, COUNT_ZERO_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [aiRepCount, currentPhase, mission.countMode, movement.id])

  useEffect(() => {
    if (!pose) return
    const bodySeen = pose.visibleLandmarks > 0 || pose.trackedLandmarks > 0 || pose.bodyConfidence > 0.05
    if (!bodySeen) return

    const now = Date.now()
    setLastDetectedAgeMs(0)
    setAttemptPoseSummary(previous => ({
      sawBody: true,
      bestVisibleLandmarks: Math.max(previous.bestVisibleLandmarks, pose.visibleLandmarks),
      bestTrackedLandmarks: Math.max(previous.bestTrackedLandmarks, pose.trackedLandmarks),
      bestBodyConfidence: Math.max(previous.bestBodyConfidence, pose.bodyConfidence),
      bestDetectionFps: Math.max(previous.bestDetectionFps, pose.detectionFps),
      lastDetectedAt: now,
    }))
  }, [pose])

  useEffect(() => {
    if (!attemptPoseSummary.lastDetectedAt) return

    function updateLastDetectedAge() {
      setLastDetectedAgeMs(Math.max(0, Date.now() - (attemptPoseSummary.lastDetectedAt ?? 0)))
    }

    updateLastDetectedAge()
    const intervalId = window.setInterval(updateLastDetectedAge, 1000)
    return () => window.clearInterval(intervalId)
  }, [attemptPoseSummary.lastDetectedAt])

  async function run(action: () => Promise<void> | void, message: string, voice?: VoiceFeedback) {
    if (voice) voiceCoachRef.current.unlock()
    setNotice('Saving internal annotation…')
    try {
      await action()
      setNotice(message)
      if (voice) {
        voiceCoachRef.current.speak({
          key: `test-lab-${voice.key}`,
          text: voice.text,
          cooldownMs: 0,
        }, true)
      }
    } catch (error) {
      setNotice(`Could not save annotation: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  function currentBodyMissing() {
    return !pose || pose.visibleLandmarks === 0 || pose.framingStatus === 'no-body'
  }

  function attemptHadCalibrationReady() {
    return attemptHadCameraReady()
  }

  function attemptHadCameraReady() {
    const genericFullBodyReady = attemptPoseSummary.bestBodyConfidence >= 0.55
      && attemptPoseSummary.bestVisibleLandmarks >= 18
    const trackingProfileReady = attemptPoseSummary.bestTrackedLandmarks > 0
      && attemptPoseSummary.bestBodyConfidence >= 0.55
      && attemptPoseSummary.bestVisibleLandmarks / attemptPoseSummary.bestTrackedLandmarks >= 0.7
    return genericFullBodyReady || trackingProfileReady
  }

  function attemptLastDetectedLabel() {
    if (lastDetectedAgeMs === null) return 'not yet'
    const seconds = Math.max(0, Math.round(lastDetectedAgeMs / 1000))
    if (seconds <= 1) return 'just now'
    return `${seconds}s ago`
  }

  function attemptRecommendation() {
    if (
      currentPhase === 'camera'
      && !mission.canLogCameraSuccess
      && attemptPoseSummary.bestBodyConfidence >= 0.55
      && attemptPoseSummary.bestVisibleLandmarks === 0
      && attemptPoseSummary.bestTrackedLandmarks === 0
    ) {
      return 'Recommended record: We have a confidence signal but 0 body landmarks. Confidence alone is not a camera pass. Move back or tilt until at least 18 landmarks or enough required tracking points are visible; after 30s, log Camera issue.'
    }
    if (currentPhase === 'camera' && !mission.canLogCameraSuccess) {
      return 'Recommended record: High confidence alone is not a camera pass. Keep adjusting placement until head, torso, hips, and required limbs are visible. If it still has not passed after 30s, log Camera issue.'
    }
    if (currentPhase === 'calibrating' && !mission.canLogCalibrationSuccess) {
      return 'Recommended record: Keep holding the required starting shape. If calibration still has not passed after 30s, log Calibration issue.'
    }
    if (attemptPoseSummary.sawBody && currentBodyMissing()) {
      return 'Recommended record: If detection appeared and then dropped only after you returned to the screen, still record the movement result as pass. Log Tracking flicker only if it dropped during the movement or capture.'
    }
    if (!attemptPoseSummary.sawBody) {
      return 'Recommended record: Body not detected. Log camera failed only if the body never appeared during the attempt.'
    }
    if (!mission.canLogCalibrationSuccess && !attemptHadCalibrationReady()) {
      return 'Recommended record: Camera can see you, but calibration is not stable. Log calibration failed.'
    }
    if (currentPhase === 'capture' || currentPhase === 'exercising') {
      return 'Recommended record: If the movement happened clearly but AI count stayed wrong or zero, log count failed.'
    }
    return 'Recommended record: Log the pass or fail button for the standard you just observed.'
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
      framingStatus: pose?.framingStatus ?? null,
      missingBodyParts: pose?.missingBodyParts.join(', ') || null,
      delta: counter?.diagnostics.delta ?? null,
      attemptSawBody: attemptPoseSummary.sawBody,
      attemptBestVisibleLandmarks: attemptPoseSummary.bestVisibleLandmarks,
      attemptBestTrackedLandmarks: attemptPoseSummary.bestTrackedLandmarks,
      attemptBestBodyConfidence: Number(attemptPoseSummary.bestBodyConfidence.toFixed(3)),
      attemptBestDetectionFps: Number(attemptPoseSummary.bestDetectionFps.toFixed(1)),
      attemptLastDetectedAgeMs: lastDetectedAgeMs,
    }
  }

  function logCount() {
    const nextCount = observedCount + 1
    setObservedCount(nextCount)
    void run(
      () => onCountObserved(nextCount, countDiagnosticEvidence()),
      `Observed count ${nextCount} logged.`,
      { key: `count-observed-${nextCount}`, text: `Observed count ${nextCount} recorded.` },
    )
  }

  function checklistLabel(item: { key: string; label: string }) {
    if (item.key === 'count' && counter) return `${item.label} · AI ${counter.repCount}/${scenario.repeats}`
    return item.label
  }

  function mobileChecklistLabel(item: { key: string; label: string }) {
    if (item.key === 'count' && counter) return `AI ${counter.repCount}/${scenario.repeats}`
    if (item.key === 'camera') return 'Camera'
    if (item.key === 'calibration') return 'Calib'
    return 'Count'
  }

  function countFailureAction(): ExerciseMissionQuickAction {
    return counter?.repCount === 0 ? 'ai-count-zero' : 'count-missed'
  }

  function renderMissionBody() {
    const canRecordCameraFromAttempt = currentPhase === 'camera' && (mission.canLogCameraSuccess || attemptHadCameraReady())
    const canRecordCalibrationFromAttempt = currentPhase === 'calibrating' && (mission.canLogCalibrationSuccess || attemptHadCalibrationReady())
    const canRecordCountPass = countReadyForHumanConfirmation
    const canRecordCountFailureFromAttempt = (currentPhase === 'capture' || currentPhase === 'exercising') && attemptPoseSummary.sawBody

    return (
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

        {showSpecificMissingBodyParts && (
          <div role="status" className="rounded-xl border border-amber-300/40 bg-amber-300/[0.12] px-3 py-2 text-xs leading-relaxed text-amber-50">
            <span className="font-semibold">Keypoints needed:</span> {formatBodyParts(visibleMissingBodyParts)}
          </div>
        )}

        {pose && (
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-white/60">
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.visibleLandmarks}</span>visible</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.trackedLandmarks}</span>tracked</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{Math.round(pose.bodyConfidence * 100)}%</span>confidence</div>
            <div className="rounded-xl bg-white/[0.07] p-2"><span className="block text-white">{pose.detectionFps}</span>fps</div>
          </div>
        )}

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] leading-relaxed text-white/65">{attemptRecommendation()}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-white/60">
            <div className="rounded-xl bg-white/[0.06] p-2">
              <span className="block text-white">{attemptPoseSummary.bestVisibleLandmarks}</span>
              Best landmarks this attempt
            </div>
            <div className="rounded-xl bg-white/[0.06] p-2">
              <span className="block text-white">{Math.round(attemptPoseSummary.bestBodyConfidence * 100)}%</span>
              confidence signal
            </div>
            <div className="rounded-xl bg-white/[0.06] p-2">
              <span className="block text-white">{attemptLastDetectedLabel()}</span>
              Last signal
            </div>
          </div>
        </div>

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
          <p className="text-[11px] leading-relaxed text-white/55">
            Record one result after each attempt. Camera failed = body never appeared; Tracking flicker = body dropped during movement/capture, not after you walk back.
          </p>
          <div className="grid gap-2">
            <div className="grid grid-cols-[5.5rem_1fr_1fr] items-stretch gap-2">
              <div className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/75">Camera</div>
              <button
                type="button"
                disabled={!canRecordCameraFromAttempt}
                onClick={() => void run(
                  () => onQuickAction('camera-pass', countDiagnosticEvidence()),
                  'Camera pass logged.',
                  { key: 'camera-pass', text: 'Camera passed recorded.' },
                )}
                className={PASS_BUTTON_CLASS}
              >
                Log camera passed
              </button>
              <button
                type="button"
                onClick={() => void run(
                  () => onQuickAction('camera-placement', countDiagnosticEvidence()),
                  'Camera failed logged.',
                  { key: 'camera-fail', text: 'Camera issue recorded.' },
                )}
                className={FAIL_BUTTON_CLASS}
              >
                Log camera failed
              </button>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr_1fr] items-stretch gap-2">
              <div className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/75">Calib</div>
              <button
                type="button"
                disabled={!canRecordCalibrationFromAttempt}
                onClick={() => void run(
                  () => onQuickAction('calibration-pass', countDiagnosticEvidence()),
                  'Calibration pass logged.',
                  { key: 'calibration-pass', text: 'Calibration passed recorded.' },
                )}
                className={PASS_BUTTON_CLASS}
              >
                Log calibration passed
              </button>
              <button
                type="button"
                onClick={() => void run(
                  () => onQuickAction('calibration-stuck', countDiagnosticEvidence()),
                  'Calibration failed logged.',
                  { key: 'calibration-fail', text: 'Calibration issue recorded.' },
                )}
                className={FAIL_BUTTON_CLASS}
              >
                Log calibration failed
              </button>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr_1fr] items-stretch gap-2">
              <div className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/75">Count</div>
              <button
                type="button"
                disabled={!canRecordCountPass}
                onClick={() => void run(
                  () => onQuickAction('count-pass', countDiagnosticEvidence()),
                  'Count pass logged.',
                  { key: 'count-pass', text: 'Count passed recorded.' },
                )}
                className={COUNT_PASS_BUTTON_CLASS}
              >
                Log count passed
              </button>
              <button
                type="button"
                disabled={!canRecordCountFailureFromAttempt}
                onClick={() => void run(
                  () => onQuickAction(countFailureAction(), countDiagnosticEvidence()),
                  'Count failed logged.',
                  { key: 'count-fail', text: 'Count issue recorded.' },
                )}
                className={FAIL_BUTTON_CLASS}
              >
                Log count failed
              </button>
            </div>
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
                () => onQuickAction(item.action, countDiagnosticEvidence()),
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
    )
  }

  return (
    <>
      <section
        aria-label="Mobile mission summary"
        className="pointer-events-auto fixed inset-x-3 bottom-3 z-[90] overflow-hidden rounded-[1.2rem] border border-white/[0.15] bg-slate-950/[0.9] text-white shadow-2xl backdrop-blur-xl lg:hidden"
      >
        <div className="p-3">
          <button
            type="button"
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded(value => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-sage-light">
                QA mission · {currentPhase}
              </span>
              <span className="mt-1 block truncate font-serif text-base leading-tight">{movement.displayName}</span>
            </span>
            <span className="shrink-0 rounded-full bg-sage-light px-3 py-1 text-[11px] font-semibold text-slate-950">
              {mobileExpanded ? 'Hide controls' : 'Show controls'}
            </span>
          </button>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {mission.checklist.map(item => (
              <span
                key={item.key}
                className={`truncate rounded-full border px-2 py-1 text-center text-[10px] ${stateClass(item.state)}`}
              >
                {mobileChecklistLabel(item)}
              </span>
            ))}
          </div>
          {!mobileExpanded && (
            <p className="mt-2 truncate text-[11px] text-white/55">{mission.headline}</p>
          )}
        </div>

        {mobileExpanded && (
          <div className="max-h-[42dvh] overflow-y-auto border-t border-white/10">
            {renderMissionBody()}
          </div>
        )}
      </section>

      <section className="pointer-events-auto fixed left-3 top-3 z-[90] hidden max-h-[calc(100dvh-1.5rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[1.4rem] border border-white/[0.15] bg-slate-950/[0.88] text-white shadow-2xl backdrop-blur-xl lg:block">
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

        {renderMissionBody()}
      </section>
    </>
  )
}
