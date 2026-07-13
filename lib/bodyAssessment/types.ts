import type { BodyMirrorMovement, MovementDimension } from '../bodyMirror/types'
import type { PoseLandmark } from '../poseTracking'

export type { PoseLandmark }

export interface AssessmentPoseSample {
  capturedAt: number
  bodyConfidence: number
  landmarks: PoseLandmark[]
  phase?: 'baseline' | 'movement'
}

export interface DerivedObservation {
  movementKey: BodyMirrorMovement
  dimension: MovementDimension
  side: 'left' | 'right' | 'center' | 'bilateral'
  metricKey: string
  value: number
  unit: string
  betterDirection: 'higher' | 'lower'
  changeThreshold: number
  confidence: number
}

export type AssessmentFailureReason = 'insufficient_samples' | 'baseline_missing' | 'landmarks' | 'range'

export type MovementDerivation =
  | { status: 'reliable'; overallConfidence: number; observations: DerivedObservation[] }
  | { status: 'low_confidence'; overallConfidence: number; reason: AssessmentFailureReason }
