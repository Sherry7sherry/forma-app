import type { FramingStatus, PoseDiagnostics } from '@/components/camera/PoseCamera'
import type { TestableMovement } from '@/lib/internalTesting/types'

export type ExerciseMissionPhase = 'setup' | 'capture' | 'calibrating' | 'exercising' | string
export type ExerciseMissionStatus = 'setup' | 'waiting' | 'ready' | 'observing'
export type ExerciseMissionChecklistState = 'pending' | 'active' | 'done' | 'warn'
type EvidenceValue = string | number | boolean | null
export type ExerciseMissionCountEvidence = Record<string, EvidenceValue | undefined>
export type ExerciseMissionQuickAction =
  | 'camera-pass'
  | 'camera-placement'
  | 'calibration-stuck'
  | 'calibration-pass'
  | 'calibration-ready'
  | 'count-pass'
  | 'count-observed'
  | 'ai-count-zero'
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
  countMode: TestableMovement['trackingMode']
  headline: string
  guidance: string
  guardrail: string
  primaryMetric: {
    label: string
    value: string
  }
  canLogSuccess: boolean
  canLogCameraSuccess: boolean
  canLogCalibrationSuccess: boolean
  canLogCountSuccess: boolean
  checklist: ExerciseMissionChecklistItem[]
}

interface MissionInput {
  movement: TestableMovement
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

function checklistFor(
  pose: ExerciseMissionPoseSnapshot | null,
  phase: ExerciseMissionPhase,
  movement: TestableMovement,
): ExerciseMissionChecklistItem[] {
  const hasCamera = cameraReady(pose)
  const hasBody = bodyReady(pose)
  const countActive = phase === 'exercising' || phase === 'capture'
  return [
    {
      key: 'camera',
      label: hasCamera ? 'Camera · Pass' : 'Camera · Find body in frame',
      state: hasCamera ? 'done' : 'active',
    },
    {
      key: 'calibration',
      label: hasBody ? 'Calibration · Pass' : 'Calibration · Make required body shape visible',
      state: hasBody ? 'done' : hasCamera ? 'active' : 'pending',
    },
    {
      key: 'count',
      label: movement.kind === 'assessment'
        ? 'Count · Capture assessment evidence'
        : 'Count · Verify AI count',
      state: countActive && hasBody ? 'active' : hasBody ? 'pending' : 'pending',
    },
  ]
}

export function deriveExerciseMissionState({ movement, phase, repeats, pose }: MissionInput): ExerciseMissionState {
  const hasBody = bodyReady(pose)
  const countMode = movement.trackingMode
  const guardrail = 'No Test Lab-only counting. This panel records tester observations as internal evidence only.'
  const common = {
    canLogCameraSuccess: cameraReady(pose),
    canLogCalibrationSuccess: hasBody,
    canLogCountSuccess: hasBody && (phase === 'exercising' || phase === 'capture'),
  }

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
      ...common,
      checklist: checklistFor(pose, phase, movement),
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
      ...common,
      checklist: checklistFor(pose, phase, movement),
    }
  }

  if (phase === 'capture' && movement.kind === 'assessment') {
    return {
      status: 'observing',
      countMode,
      headline: 'Capture assessment count evidence',
      guidance: 'Use the same Camera, Calibration, Count standards. Mark count passed when the assessment movement evidence was captured clearly.',
      guardrail,
      primaryMetric: {
        label: 'Assessment',
        value: 'Evidence',
      },
      canLogSuccess: hasBody,
      ...common,
      checklist: checklistFor(pose, phase, movement),
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
    ...common,
    checklist: checklistFor(pose, phase, movement),
  }
}

function outcomeFor(action: ExerciseMissionQuickAction) {
  if (action === 'camera-pass' || action === 'calibration-pass' || action === 'calibration-ready' || action === 'count-pass') return 'pass'
  if (action === 'ai-count-zero' || action === 'count-missed' || action === 'false-count') return 'fail'
  return 'note'
}

function eventTypeFor(action: ExerciseMissionQuickAction) {
  if (action === 'camera-pass') return 'camera_status'
  if (action === 'calibration-pass' || action === 'calibration-ready') return 'calibration'
  if (action === 'count-pass' || action === 'count-observed') return 'count'
  return 'blocker'
}

export function missionEventForQuickAction(
  action: ExerciseMissionQuickAction,
  movement: Pick<TestableMovement, 'id'>,
  phase: ExerciseMissionPhase,
  observedCount?: number,
  evidence: Record<string, EvidenceValue | undefined> = {},
) {
  const eventType = eventTypeFor(action)
  const data: Record<string, EvidenceValue> = {
    action,
    movementId: movement.id,
    phase,
    outcome: outcomeFor(action),
    productionEvidence: false,
    synthetic: true,
  }
  if (action === 'count-observed') data.observedCount = observedCount ?? 0
  if (action === 'ai-count-zero') data.reason = 'ai-count-zero'
  for (const [key, value] of Object.entries(evidence)) {
    if (value !== undefined) data[key] = value
  }
  return { eventType, elapsedMs: 0, data }
}
