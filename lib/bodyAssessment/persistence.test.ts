import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildAssessmentCompletion,
  buildAssessmentInsert,
  buildObservationInserts,
  selectAssessmentKind,
} from './persistence'
import type { DerivedObservation } from './types'

const observations: DerivedObservation[] = [
  {
    movementKey: 'side_arm_raise',
    dimension: 'mobility',
    side: 'bilateral',
    metricKey: 'max_arm_elevation_deg',
    value: 152,
    unit: 'deg',
    betterDirection: 'higher',
    changeThreshold: 5,
    confidence: 0.88,
  },
]

describe('assessment persistence payloads', () => {
  it('starts a camera assessment without marking it completed', () => {
    assert.deepEqual(buildAssessmentInsert({
      userId: 'user-1',
      kind: 'baseline',
      captureMode: 'camera',
      bodyCheckInId: 'check-1',
      startedAt: '2026-07-01T08:00:00.000Z',
    }), {
      user_id: 'user-1',
      kind: 'baseline',
      capture_mode: 'camera',
      status: 'in_progress',
      overall_confidence: null,
      body_check_in_id: 'check-1',
      started_at: '2026-07-01T08:00:00.000Z',
      completed_at: null,
    })
  })

  it('builds owned observation rows with stable comparison fields', () => {
    assert.deepEqual(buildObservationInserts({
      assessmentId: 'assessment-1',
      userId: 'user-1',
      observations,
      observedAt: '2026-07-01T08:01:00.000Z',
    }), [{
      assessment_id: 'assessment-1',
      user_id: 'user-1',
      movement_key: 'side_arm_raise',
      dimension: 'mobility',
      side: 'bilateral',
      metric_key: 'max_arm_elevation_deg',
      value: 152,
      unit: 'deg',
      better_direction: 'higher',
      change_threshold: 5,
      confidence: 0.88,
      observed_at: '2026-07-01T08:01:00.000Z',
    }])
  })

  it('keeps non-applying outcomes explicit and validates reliable completion', () => {
    assert.equal(buildAssessmentCompletion({ outcome: 'partial', completedAt: '2026-07-01T08:02:00.000Z' }).status, 'partial')
    assert.equal(buildAssessmentCompletion({ outcome: 'camera_unavailable', completedAt: '2026-07-01T08:02:00.000Z' }).overall_confidence, null)
    assert.equal(buildAssessmentCompletion({ outcome: 'low_confidence', overallConfidence: 0.61, completedAt: '2026-07-01T08:02:00.000Z' }).status, 'low_confidence')
    assert.equal(buildAssessmentCompletion({ outcome: 'completed', overallConfidence: 0.82, completedAt: '2026-07-01T08:02:00.000Z' }).status, 'completed')
    assert.throws(() => buildAssessmentCompletion({ outcome: 'completed', overallConfidence: 0.6 }), /at least 0.7/)
  })

  it('selects baseline until both movement dimensions have reliable evidence', () => {
    assert.equal(selectAssessmentKind({ mobility: 'no_data', control: 'no_data' }), 'baseline')
    assert.equal(selectAssessmentKind({ mobility: 'baseline', control: 'baseline' }), 'reassessment')
  })
})
