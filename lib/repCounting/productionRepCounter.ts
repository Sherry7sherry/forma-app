import type { ExerciseTrackingProfile } from '../exerciseTracking'
import {
  hasTrackingCoverage,
  isWithinTrackingGrace,
  normalizedPoseDistance,
  type PoseLandmark,
} from '../poseTracking'
import type { VoiceCue } from '../voiceCoach'

export const REP_COOLDOWN_MS = 700
export const MOVEMENT_TIMEOUT_MS = 12_000
export const REP_COUNTED_DISPLAY_MS = 800
export const DEBUG_POSE_LOG_INTERVAL_MS = 500

export type AiRepPhase =
  | 'unsupported_exercise'
  | 'waiting_for_full_body'
  | 'ready_for_baseline'
  | 'waiting_for_engaged_phase'
  | 'waiting_for_return_phase'
  | 'rep_counted'
  | 'tracking_lost'

export type FramingDetail = 'no-body' | 'upper-body' | 'low-confidence' | null

export interface AiRepStatus {
  chip: string
  tone: 'tracking' | 'attention' | 'success' | 'muted'
  message: string
  voice?: VoiceCue
}

export type RepCycleStage = 'Start' | 'Move' | 'Return' | 'Count'

export interface RepDiagnostics {
  usable: boolean
  visible: number
  required: number
  confidence: number
  delta: number
}

export interface ProductionRepCounterState {
  phase: AiRepPhase
  framingDetail: FramingDetail
  movementStale: boolean
  repCount: number
  repFlash: boolean
  qualityCue: string | null
  diagnostics: RepDiagnostics
  baselineLandmarks: PoseLandmark[] | null
  lastPoseLogAtMs: number
  lastConfidentAtMs: number | null
  hasTracked: boolean
  engagedSinceMs: number | null
  repCooldownAtMs: number
  repCountedUntilMs: number | null
}

export type ProductionRepCounterEventType = 'pose_update' | 'phase_change' | 'count' | 'quality_cue'

export interface ProductionRepCounterEvent {
  type: ProductionRepCounterEventType
  data: Record<string, string | number | boolean | null>
}

export interface ProductionRepPoseInput {
  framingStatus: string
  landmarks: PoseLandmark[]
  bodyConfidence?: number
}

export interface ProductionRepCounterOptions {
  exerciseName: string | undefined
  trackingProfile: ExerciseTrackingProfile
  targetReps: number
  nowMs: number
}

export function describeAiRepStatus(phase: AiRepPhase, detail: FramingDetail, movementStale: boolean): AiRepStatus {
  switch (phase) {
    case 'unsupported_exercise':
      return {
        chip: 'Manual counting for now',
        tone: 'muted',
        message: 'This exercise requires manual counting for now — AI form feedback is still active.',
        voice: { key: 'unsupported', text: 'This movement needs manual counting for now.', cooldownMs: 45_000 },
      }

    case 'waiting_for_full_body':
    case 'tracking_lost': {
      const isLost = phase === 'tracking_lost'
      if (detail === 'upper-body') {
        return {
          chip: 'Step back',
          tone: 'attention',
          message: 'Step back, I need your full body.',
          voice: { key: 'upper-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
        }
      }
      if (detail === 'low-confidence') {
        return {
          chip: 'Low confidence',
          tone: 'attention',
          message: 'Improve lighting or slow down.',
          voice: { key: 'tracking-low-confidence', text: 'Improve lighting or slow down.', cooldownMs: 8_000 },
        }
      }
      return {
        chip: isLost ? 'Tracking lost' : 'Full body needed',
        tone: 'attention',
        message: 'Step back, I need your full body.',
        voice: { key: 'full-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
      }
    }

    case 'ready_for_baseline':
      return {
        chip: 'Getting ready…',
        tone: 'tracking',
        message: "Full body visible — hold your starting position for a moment.",
        voice: { key: 'ready', text: "I can see your full body. Start when you're ready.", cooldownMs: 20_000 },
      }

    case 'waiting_for_engaged_phase':
      if (movementStale) {
        return {
          chip: 'Movement not detected yet',
          tone: 'attention',
          message: 'Move a little bigger.',
          voice: { key: 'movement-stale', text: 'Move a little bigger.', cooldownMs: 8_000 },
        }
      }
      return {
        chip: 'AI counting reps',
        tone: 'tracking',
        message: "AI is tracking you — go ahead whenever you're ready.",
      }

    case 'waiting_for_return_phase':
      return {
        chip: 'Return to start',
        tone: 'tracking',
        message: 'Return to start.',
        voice: { key: 'return-phase', text: 'Return to start.', cooldownMs: 4_000 },
      }

    case 'rep_counted':
      return {
        chip: 'Counted +1',
        tone: 'success',
        message: 'Counted.',
        voice: { key: `rep-counted-${Date.now()}`, text: 'Good.', cooldownMs: 0 },
      }
  }
}

export function repCycleStage(phase: AiRepPhase): RepCycleStage {
  if (phase === 'waiting_for_return_phase') return 'Return'
  if (phase === 'rep_counted') return 'Count'
  if (phase === 'waiting_for_engaged_phase') return 'Move'
  return 'Start'
}

export function requiredVisibleLandmarks(profile: ExerciseTrackingProfile): number {
  return Math.min(
    profile.landmarks.length,
    Math.max(
      profile.minVisibleLandmarks,
      Math.ceil(profile.landmarks.length * profile.minVisibleRatio),
    ),
  )
}

export function detectQualityCue(exerciseName: string | undefined, landmarks: PoseLandmark[]): string | null {
  if (!exerciseName || !landmarks?.length) return null

  const leftEar = landmarks[7]
  const rightEar = landmarks[8]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const leftKnee = landmarks[25]
  const rightKnee = landmarks[26]

  if (exerciseName === 'Glute Bridge') {
    if (leftHip && rightHip && Math.abs(leftHip.y - rightHip.y) > 0.045) return 'Keep both hips level'
    if (leftKnee && rightKnee && leftHip && rightHip && Math.abs(leftKnee.x - rightKnee.x) < Math.abs(leftHip.x - rightHip.x) * 0.65) return 'Press knees forward'
    if (leftShoulder && rightShoulder && leftHip && rightHip) return 'Lift from your glutes'
  }

  if (exerciseName === 'Chest Lift') {
    if (leftEar && leftShoulder && Math.abs(leftEar.x - leftShoulder.x) > 0.12) return 'Keep your neck long'
    if (rightEar && rightShoulder && Math.abs(rightEar.x - rightShoulder.x) > 0.12) return 'Keep your neck long'
    if (leftShoulder && rightShoulder && leftHip && rightHip && Math.abs(leftShoulder.y - leftHip.y) < 0.18) return 'Soften your ribs'
    return 'Leave space under your chin'
  }

  return null
}

export function createProductionRepCounterState({
  mode,
  initialRepCount = 0,
}: {
  mode: ExerciseTrackingProfile['mode']
  targetReps: number
  initialRepCount?: number
}): ProductionRepCounterState {
  return {
    phase: mode === 'manual' ? 'unsupported_exercise' : 'waiting_for_full_body',
    framingDetail: null,
    movementStale: false,
    repCount: initialRepCount,
    repFlash: false,
    qualityCue: null,
    diagnostics: { usable: false, visible: 0, required: 0, confidence: 0, delta: 0 },
    baselineLandmarks: null,
    lastPoseLogAtMs: 0,
    lastConfidentAtMs: null,
    hasTracked: false,
    engagedSinceMs: null,
    repCooldownAtMs: 0,
    repCountedUntilMs: null,
  }
}

function cloneLandmarks(landmarks: PoseLandmark[]) {
  return landmarks.map(point => ({ ...point }))
}

function pushPoseEvent(
  events: ProductionRepCounterEvent[],
  state: ProductionRepCounterState,
  result: ProductionRepPoseInput,
  confidence: number,
  visibleCount: number,
  requiredCount: number,
  delta: number,
  nowMs: number,
) {
  if (nowMs - state.lastPoseLogAtMs <= DEBUG_POSE_LOG_INTERVAL_MS) return state
  events.push({
    type: 'pose_update',
    data: {
      framingStatus: result.framingStatus,
      bodyConfidence: confidence,
      visibleLandmarks: visibleCount,
      requiredLandmarks: requiredCount,
      delta,
    },
  })
  return { ...state, lastPoseLogAtMs: nowMs }
}

function transition(
  events: ProductionRepCounterEvent[],
  state: ProductionRepCounterState,
  phase: AiRepPhase,
  framingDetail: FramingDetail,
  movementStale: boolean,
): ProductionRepCounterState {
  events.push({
    type: 'phase_change',
    data: {
      aiRepPhase: phase,
      framingStatus: framingDetail ?? 'tracked',
      movementStale,
    },
  })
  return { ...state, phase, framingDetail, movementStale }
}

export function processProductionRepPose(
  currentState: ProductionRepCounterState,
  result: ProductionRepPoseInput,
  options: ProductionRepCounterOptions,
): { state: ProductionRepCounterState; events: ProductionRepCounterEvent[] } {
  const { exerciseName, trackingProfile, targetReps, nowMs } = options
  const lm = result.landmarks ?? []
  const confidence = result.bodyConfidence ?? 0
  const events: ProductionRepCounterEvent[] = []
  let state = { ...currentState }

  if (state.phase === 'unsupported_exercise' || trackingProfile.mode === 'manual') {
    return { state: { ...state, phase: 'unsupported_exercise' }, events }
  }

  if (state.phase === 'rep_counted' && state.repCountedUntilMs !== null && nowMs >= state.repCountedUntilMs) {
    state = transition(events, { ...state, repFlash: false, repCountedUntilMs: null }, 'waiting_for_engaged_phase', null, false)
  }

  const visibleCount = trackingProfile.landmarks.filter(
    index => (lm[index]?.visibility ?? 0) >= trackingProfile.minVisibility,
  ).length
  const requiredCount = requiredVisibleLandmarks(trackingProfile)
  const trackedVisible = hasTrackingCoverage(lm, trackingProfile.landmarks, trackingProfile)
  const confident = result.framingStatus === 'full-body'
    && lm.length >= 29
    && confidence >= trackingProfile.confidenceThreshold
    && trackedVisible

  if (!confident) {
    state = pushPoseEvent(events, state, result, confidence, visibleCount, requiredCount, 0, nowMs)
    state = { ...state, diagnostics: { usable: false, visible: visibleCount, required: requiredCount, confidence, delta: 0 }, qualityCue: null }

    let detail: FramingDetail = 'low-confidence'
    if (result.framingStatus === 'no-body' || lm.length < 29) detail = 'no-body'
    else if (result.framingStatus === 'upper-body') detail = 'upper-body'

    if (isWithinTrackingGrace(state.lastConfidentAtMs, nowMs, trackingProfile.trackingGraceMs)) {
      return { state, events }
    }

    const nextPhase: AiRepPhase = state.hasTracked ? 'tracking_lost' : 'waiting_for_full_body'
    const shouldTransition = state.phase !== nextPhase || state.framingDetail !== detail || state.movementStale
    state = {
      ...state,
      baselineLandmarks: null,
      lastConfidentAtMs: null,
      engagedSinceMs: null,
      movementStale: false,
    }
    if (shouldTransition) state = transition(events, state, nextPhase, detail, false)
    return { state, events }
  }

  state = {
    ...state,
    hasTracked: true,
    lastConfidentAtMs: nowMs,
    framingDetail: null,
  }

  const nextQualityCue = detectQualityCue(exerciseName, lm)
  if (state.qualityCue !== nextQualityCue) {
    state = { ...state, qualityCue: nextQualityCue }
    if (nextQualityCue) {
      events.push({
        type: 'quality_cue',
        data: {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          qualityCue: nextQualityCue,
        },
      })
    }
  }

  if (state.phase === 'rep_counted') {
    return { state, events }
  }

  if (!state.baselineLandmarks) {
    state = pushPoseEvent(events, state, result, confidence, visibleCount, requiredCount, 0, nowMs)
    state = { ...state, baselineLandmarks: cloneLandmarks(lm) }
    if (state.phase !== 'ready_for_baseline') state = transition(events, state, 'ready_for_baseline', null, false)
    return { state, events }
  }

  if (state.phase === 'ready_for_baseline') {
    state = transition(events, state, 'waiting_for_engaged_phase', null, false)
    state = { ...state, engagedSinceMs: nowMs }
  }

  const delta = normalizedPoseDistance(lm, state.baselineLandmarks, trackingProfile.landmarks, trackingProfile.minVisibility)
  state = {
    ...state,
    diagnostics: { usable: true, visible: visibleCount, required: requiredCount, confidence, delta },
  }
  state = pushPoseEvent(events, state, result, confidence, visibleCount, requiredCount, delta, nowMs)

  if (state.phase === 'waiting_for_engaged_phase') {
    if (delta > trackingProfile.engageThreshold) {
      state = transition(events, { ...state, movementStale: false }, 'waiting_for_return_phase', null, false)
    } else if (state.engagedSinceMs && nowMs - state.engagedSinceMs > MOVEMENT_TIMEOUT_MS && !state.movementStale) {
      state = transition(events, { ...state, movementStale: true }, 'waiting_for_engaged_phase', null, true)
    }
    return { state, events }
  }

  if (state.phase === 'waiting_for_return_phase') {
    if (delta < trackingProfile.returnThreshold && nowMs - state.repCooldownAtMs > REP_COOLDOWN_MS) {
      const nextRep = Math.min(targetReps, state.repCount + 1)
      state = {
        ...state,
        repCooldownAtMs: nowMs,
        baselineLandmarks: cloneLandmarks(lm),
        repCount: nextRep,
        repFlash: true,
        engagedSinceMs: nowMs,
        movementStale: false,
        repCountedUntilMs: nowMs + REP_COUNTED_DISPLAY_MS,
      }
      events.push({
        type: 'count',
        data: {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta,
          repCount: nextRep,
        },
      })
      state = transition(events, state, 'rep_counted', null, false)
    }
  }

  return { state, events }
}
