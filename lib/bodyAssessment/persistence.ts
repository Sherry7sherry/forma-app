import {
  BODY_MIRROR_CONFIDENCE_THRESHOLD,
  type MovementAssessmentEvidence,
} from '../bodyMirror/types'
import type { DerivedObservation } from './types'

export type AssessmentKind = MovementAssessmentEvidence['kind']
export type AssessmentCaptureMode = MovementAssessmentEvidence['captureMode']
export type AssessmentOutcome = 'completed' | 'partial' | 'camera_unavailable' | 'low_confidence'

export interface AssessmentInsertInput {
  userId: string
  kind: AssessmentKind
  captureMode: AssessmentCaptureMode
  bodyCheckInId?: string | null
  startedAt?: string
}

export function buildAssessmentInsert(input: AssessmentInsertInput) {
  return {
    user_id: input.userId,
    kind: input.kind,
    capture_mode: input.captureMode,
    status: 'in_progress' as const,
    overall_confidence: null,
    body_check_in_id: input.bodyCheckInId ?? null,
    started_at: input.startedAt ?? new Date().toISOString(),
    completed_at: null,
  }
}

export interface ObservationInsertInput {
  assessmentId: string
  userId: string
  observations: DerivedObservation[]
  observedAt?: string
}

export function buildObservationInserts(input: ObservationInsertInput) {
  const observedAt = input.observedAt ?? new Date().toISOString()
  return input.observations.map(observation => ({
    assessment_id: input.assessmentId,
    user_id: input.userId,
    movement_key: observation.movementKey,
    dimension: observation.dimension,
    side: observation.side,
    metric_key: observation.metricKey,
    value: observation.value,
    unit: observation.unit,
    better_direction: observation.betterDirection,
    change_threshold: observation.changeThreshold,
    confidence: observation.confidence,
    observed_at: observedAt,
  }))
}

export function buildAssessmentCompletion(input: {
  outcome: AssessmentOutcome
  overallConfidence?: number | null
  completedAt?: string
}) {
  const confidence = input.overallConfidence ?? null
  if (input.outcome === 'completed' && (confidence ?? 0) < BODY_MIRROR_CONFIDENCE_THRESHOLD) {
    throw new Error(`Completed assessment confidence must be at least ${BODY_MIRROR_CONFIDENCE_THRESHOLD}.`)
  }
  return {
    status: input.outcome,
    overall_confidence: confidence,
    completed_at: input.completedAt ?? new Date().toISOString(),
    ...(input.outcome === 'camera_unavailable' ? { capture_mode: 'self_report' as const } : {}),
  }
}

export function selectAssessmentKind(states: {
  mobility: 'no_data' | 'baseline' | 'improved' | 'steady' | 'declined'
  control: 'no_data' | 'baseline' | 'improved' | 'steady' | 'declined'
}): Exclude<AssessmentKind, 'daily'> {
  return states.mobility === 'no_data' || states.control === 'no_data' ? 'baseline' : 'reassessment'
}
