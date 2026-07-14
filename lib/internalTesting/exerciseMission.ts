import type { FramingStatus, PoseDiagnostics } from '@/components/camera/PoseCamera'
import type { ExerciseTestableMovement, TestableMovement } from '@/lib/internalTesting/types'

export type ExerciseMissionPhase = 'setup' | 'capture' | 'calibrating' | 'exercising' | string
export type ExerciseMissionStatus = 'setup' | 'waiting' | 'ready' | 'observing'
export type ExerciseMissionChecklistState = 'pending' | 'active' | 'done' | 'warn'
export type ExerciseMissionQuickAction =
  | 'camera-placement'
  | 'calibration-stuck'
  | 'calibration-ready'
  | 'count-observed'
  | 'count-missed'
  | 'false-count'
  | 'tracking-flicker'

export interface ExerciseMissionPoseSnapshot {
  framingStatus: FramingStatus
  bodyConfidence: number
  visibleLandmarks: number
  trackedLandmarks: number
  detectionFps: number
  deviceClass: PoseDiagnostics['deviceClass']
  orientation: PoseDiagnostics['orientation']
  feedbackTypes: string[]
}

export interface ExerciseMissionChecklistItem {
  key: string
  label: string
  state: ExerciseMissionChecklistState
}

export interface ExerciseMissionState {
  status: ExerciseMissionStatus
  countMode: ExerciseTestableMovement['trackingMode']
  headline: string
  guidance: string
  guardrail: string
  primaryMetric: {
    label: string
    value: string
  }
  canLogSuccess: boolean
  checklist: ExerciseMissionChecklistItem[]
}

interface MissionInput {
  movement: ExerciseTestableMovement
  phase: ExerciseMissionPhase
  repeats: number
  pose: ExerciseMissionPoseSnapshot | null
}

export function poseSnapshotFromResult(result: {
  framingStatus: FramingStatus
  bodyConfidence: number
  feedback: { type: string }[]
  diagnostics: Pick<PoseDiagnostics, 'visibleLandmarks' | 'trackedLandmarks' | 'detectionFps' | 'deviceClass' | 'orientation'>
}): ExerciseMissionPoseSnapshot {
  return {
    framingStatus: result.framingStatus,
    bodyConfidence: Number(result.bodyConfidence.toFixed(3)),
    visibleLandmarks: result.diagnostics.visibleLandmarks,
    trackedLandmarks: result.diagnostics.trackedLandmarks,
    detectionFps: Number(result.diagnostics.detectionFps.toFixed(1)),
    deviceClass: result.diagnostics.deviceClass,
    orientation: result.diagnostics.orientation,
    feedbackTypes: result.feedback.map(item => item.type),
  }
}

function cameraReady(pose: ExerciseMissionPoseSnapshot | null) {
  return !!pose && pose.framingStatus !== 'no-body' && pose.visibleLandmarks > 0
}

function bodyReady(pose: ExerciseMissionPoseSnapshot | null) {
  if (!pose) return false
  const genericFullBodyReady = pose.framingStatus === 'full-body'
    && pose.bodyConfidence >= 0.55
    && pose.visibleLandmarks >= 18
  const trackingProfileReady = pose.trackedLandmarks > 0
    && pose.bodyConfidence >= 0.55
    && pose.visibleLandmarks / pose.trackedLandmarks >= 0.7
  return genericFullBodyReady || trackingProfileReady
}

function checklistFor(pose: ExerciseMissionPoseSnapshot | null, phase: ExerciseMissionPhase): ExerciseMissionChecklistItem[] {
  const hasCamera = cameraReady(pose)
  const hasBody = bodyReady(pose)
  return [
    {
      key: 'camera-ready',
      label: hasCamera ? 'Camera sees a body' : 'Find body in frame',
      state: hasCamera ? 'done' : 'active',
    },
    {
      key: 'body-visible',
      label: hasBody ? 'Full-body landmarks stable' : 'Make whole movement visible',
      state: hasBody ? 'done' : hasCamera ? 'active' : 'pending',
    },
    {
      key: 'record-evidence',
      label: phase === 'exercising' ? 'Log count behavior' : 'Log calibration result',
      state: hasBody ? 'active' : 'pending',
    },
  ]
}

export function deriveExerciseMissionState({ movement, phase, repeats, pose }: MissionInput): ExerciseMissionState {
  const hasBody = bodyReady(pose)
  const countMode = movement.trackingMode
  const guardrail = 'No Test Lab-only counting. This panel records tester observations as internal evidence only.'

  if (phase === 'calibrating') {
    return {
      status: hasBody ? 'ready' : 'waiting',
      countMode,
      headline: hasBody ? 'Calibration looks ready' : 'Calibrate the camera position',
      guidance: hasBody
        ? 'Log calibration passed if the production camera overlay also looks stable, then continue to exercising.'
        : 'Adjust distance, angle, and lighting until the whole required body shape stays visible.',
      guardrail,
      primaryMetric: {
        label: 'Calibration',
        value: hasBody ? 'Ready' : 'Needs body',
      },
      canLogSuccess: hasBody,
      checklist: checklistFor(pose, phase),
    }
  }

  if (phase === 'exercising') {
    const automatic = countMode === 'automatic'
    return {
      status: 'observing',
      countMode,
      headline: automatic ? 'Watch production count behavior' : 'Record tester-observed reps',
      guidance: automatic
        ? 'Production auto-count expected. Mark observed, missed, or false counts while the tester performs the movement.'
        : 'Manual/tester-observed count expected. Tap count observed when a clean rep is visible.',
      guardrail,
      primaryMetric: {
        label: automatic ? 'Target' : 'Observed',
        value: `${repeats} ${repeats === 1 ? 'rep' : 'reps'}`,
      },
      canLogSuccess: hasBody,
      checklist: checklistFor(pose, phase),
    }
  }

  return {
    status: 'setup',
    countMode,
    headline: phase === 'capture' ? 'Capture exercise evidence' : 'Set up this directed test',
    guidance: 'Confirm the camera placement and scenario before logging exercise evidence.',
    guardrail,
    primaryMetric: {
      label: 'Phase',
      value: phase,
    },
    canLogSuccess: false,
    checklist: checklistFor(pose, phase),
  }
}

export function missionEventForQuickAction(
  action: ExerciseMissionQuickAction,
  movement: Pick<TestableMovement, 'id'>,
  phase: ExerciseMissionPhase,
  observedCount?: number,
) {
  const eventType = action === 'count-observed' ? 'count' : action === 'calibration-ready' ? 'calibration' : 'blocker'
  const data: Record<string, string | number | boolean> = {
    action,
    movementId: movement.id,
    phase,
    productionEvidence: false,
    synthetic: true,
  }
  if (action === 'count-observed') data.observedCount = observedCount ?? 0
  return { eventType, elapsedMs: 0, data }
}
