export const BODY_MIRROR_CONFIDENCE_THRESHOLD = 0.7
export const CHECK_IN_FRESH_HOURS = 24
export const MOVEMENT_FRESH_DAYS = 14
export const MOVEMENT_STALE_DAYS = 30

export const BODY_MIRROR_MOVEMENTS = [
  'side_arm_raise',
  'standing_roll_down',
  'seated_trunk_rotation',
] as const

export type BodyMirrorMovement = (typeof BODY_MIRROR_MOVEMENTS)[number]
export type BodyMirrorDimensionKey = 'comfort' | 'mobility' | 'control'
export type MovementDimension = Exclude<BodyMirrorDimensionKey, 'comfort'>
export type SafetySignal =
  | 'sharp_pain'
  | 'numbness'
  | 'radiating_pain'
  | 'dizziness'
  | 'chest_pain'
  | 'shortness_of_breath'
  | 'sudden_weakness'

export interface BodyCheckInEvidence {
  id: string
  context: 'baseline' | 'daily' | 'pre_session' | 'post_session'
  comfort: number
  focusAreas: string[]
  safetySignals: SafetySignal[]
  recordedAt: string
}

export interface MovementAssessmentEvidence {
  id: string
  kind: 'baseline' | 'reassessment' | 'daily'
  captureMode: 'camera' | 'self_report'
  status: 'in_progress' | 'completed' | 'partial' | 'camera_unavailable' | 'low_confidence'
  overallConfidence: number | null
  completedAt: string | null
}

export interface MovementObservationEvidence {
  id: string
  assessmentId: string
  movementKey: BodyMirrorMovement
  dimension: MovementDimension
  side: 'left' | 'right' | 'center' | 'bilateral'
  metricKey: string
  value: number
  unit: string
  betterDirection: 'higher' | 'lower'
  changeThreshold: number
  confidence: number
  observedAt: string
}

export type SessionBodyFeeling = 'tight' | 'okay' | 'good' | 'great'

export interface SessionEvidence {
  id: string
  completedAt: string | null
  durationSeconds: number
  isPartial: boolean
  bodyFeelBefore: SessionBodyFeeling | null
  bodyFeelAfter: SessionBodyFeeling | null
}

export interface BodyMirrorEvidence {
  checkIns: BodyCheckInEvidence[]
  assessments: MovementAssessmentEvidence[]
  observations: MovementObservationEvidence[]
  sessions: SessionEvidence[]
}

export type BodyMirrorStatus =
  | 'no_data'
  | 'low_confidence'
  | 'check_in_due'
  | 'current'
  | 'stale'
  | 'safety_hold'

export type DimensionState = 'no_data' | 'baseline' | 'improved' | 'steady' | 'declined'

export interface BodyMirrorDimension {
  key: BodyMirrorDimensionKey
  state: DimensionState
  label: string
  summary: string
  detail: string
  evidenceCount: number
  asOf: string | null
}

export interface BodyMirrorFreshness {
  level: 'none' | 'fresh' | 'aging' | 'stale'
  asOf: string | null
  label: string
}

export interface BodyMirrorRecommendation {
  mode: 'baseline' | 'check_in' | 'quick' | 'full' | 'reassess' | 'pause'
  intensity: 'none' | 'gentle' | 'standard'
  title: string
  reason: string
  durationMinutes: number | null
  durationSeconds: number | null
  adjustedForWorseFeeling: boolean
}

export interface BodyMirrorActivity {
  completedSessions: number
  completedMinutes: number
  currentStreak: number
  partialAttempts: number
}

export interface BodyMirrorResult {
  resultId: string
  status: BodyMirrorStatus
  confidenceNotice: 'none' | 'latest_attempt_not_applied'
  freshness: BodyMirrorFreshness
  checkInAsOf: string | null
  dimensions: Record<BodyMirrorDimensionKey, BodyMirrorDimension>
  recommendation: BodyMirrorRecommendation
  safety: {
    shouldPause: boolean
    signals: SafetySignal[]
  }
  activity: BodyMirrorActivity
}

export interface DeriveBodyMirrorOptions {
  now?: Date
}
