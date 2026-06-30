import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createHomeBodyMirrorModel,
  createProgressBodyMirrorModel,
  deriveBodyMirror,
  type BodyMirrorEvidence,
  type MovementAssessmentEvidence,
  type MovementObservationEvidence,
} from './index.js'

const NOW = new Date('2026-06-29T08:00:00.000Z')

function assessment(
  id: string,
  completedAt: string,
  overrides: Partial<MovementAssessmentEvidence> = {},
): MovementAssessmentEvidence {
  return {
    id,
    kind: 'baseline',
    captureMode: 'camera',
    status: 'completed',
    overallConfidence: 0.9,
    completedAt,
    ...overrides,
  }
}

function observation(
  id: string,
  assessmentId: string,
  movementKey: MovementObservationEvidence['movementKey'],
  dimension: MovementObservationEvidence['dimension'],
  value: number,
  overrides: Partial<MovementObservationEvidence> = {},
): MovementObservationEvidence {
  return {
    id,
    assessmentId,
    movementKey,
    dimension,
    side: 'center',
    metricKey: `${movementKey}_${dimension}`,
    value,
    unit: dimension === 'mobility' ? 'degrees' : 'ratio',
    betterDirection: 'higher',
    changeThreshold: dimension === 'mobility' ? 3 : 0.05,
    confidence: 0.9,
    observedAt: '2026-06-20T08:00:00.000Z',
    ...overrides,
  }
}

function completeBaseline(
  id = 'baseline',
  completedAt = '2026-06-20T08:00:00.000Z',
): Pick<BodyMirrorEvidence, 'assessments' | 'observations'> {
  return {
    assessments: [assessment(id, completedAt)],
    observations: [
      observation(`${id}-arm-mobility`, id, 'side_arm_raise', 'mobility', 120),
      observation(`${id}-arm-control`, id, 'side_arm_raise', 'control', 0.72),
      observation(`${id}-roll-mobility`, id, 'standing_roll_down', 'mobility', 70),
      observation(`${id}-roll-control`, id, 'standing_roll_down', 'control', 0.68),
      observation(`${id}-rotation-mobility`, id, 'seated_trunk_rotation', 'mobility', 42),
      observation(`${id}-rotation-control`, id, 'seated_trunk_rotation', 'control', 0.7),
    ],
  }
}

function evidence(overrides: Partial<BodyMirrorEvidence> = {}): BodyMirrorEvidence {
  return {
    checkIns: [],
    assessments: [],
    observations: [],
    sessions: [],
    ...overrides,
  }
}

describe('deriveBodyMirror', () => {
  it('returns an actionable no-data state instead of zero scores', () => {
    const result = deriveBodyMirror(evidence(), { now: NOW })

    assert.equal(result.status, 'no_data')
    assert.equal(result.freshness.level, 'none')
    assert.equal(result.recommendation.mode, 'baseline')
    assert.equal(result.dimensions.comfort.state, 'no_data')
    assert.equal(result.dimensions.mobility.state, 'no_data')
    assert.equal(result.dimensions.control.state, 'no_data')
  })

  it('requires reliable observations from all three MVP movements for a baseline', () => {
    const baseline = completeBaseline()
    const missingRotation = baseline.observations.filter(
      item => item.movementKey !== 'seated_trunk_rotation',
    )

    const result = deriveBodyMirror(evidence({
      assessments: baseline.assessments,
      observations: missingRotation,
    }), { now: NOW })

    assert.equal(result.status, 'no_data')
    assert.equal(result.recommendation.mode, 'baseline')
  })

  it('retains but does not apply a low-confidence attempt to the mirror', () => {
    const baseline = completeBaseline()
    const lowConfidence = assessment('low', '2026-06-29T07:00:00.000Z', {
      kind: 'reassessment',
      status: 'low_confidence',
      overallConfidence: 0.55,
    })
    const unreliable = baseline.observations.map((item, index) => ({
      ...item,
      id: `low-${index}`,
      assessmentId: lowConfidence.id,
      value: item.value * 2,
      confidence: 0.55,
      observedAt: lowConfidence.completedAt!,
    }))

    const result = deriveBodyMirror(evidence({
      checkIns: [{
        id: 'today',
        context: 'daily',
        comfort: 3,
        focusAreas: ['neck_shoulders'],
        safetySignals: [],
        recordedAt: '2026-06-29T07:30:00.000Z',
      }],
      assessments: [...baseline.assessments, lowConfidence],
      observations: [...baseline.observations, ...unreliable],
    }), { now: NOW })

    assert.equal(result.status, 'current')
    assert.equal(result.confidenceNotice, 'latest_attempt_not_applied')
    assert.equal(result.dimensions.mobility.state, 'baseline')
    assert.equal(result.dimensions.control.state, 'baseline')
    assert.equal(result.freshness.asOf, baseline.assessments[0].completedAt)
  })

  it('shows low confidence when no reliable baseline exists', () => {
    const attempt = assessment('low', '2026-06-29T07:00:00.000Z', {
      status: 'low_confidence',
      overallConfidence: 0.5,
    })

    const result = deriveBodyMirror(evidence({ assessments: [attempt] }), { now: NOW })

    assert.equal(result.status, 'low_confidence')
    assert.equal(result.recommendation.mode, 'baseline')
    assert.equal(result.dimensions.mobility.state, 'no_data')
  })

  it('uses explicit movement freshness thresholds and asks for reassessment when stale', () => {
    const agingBaseline = completeBaseline('aging', '2026-06-09T08:00:00.000Z')
    const staleBaseline = completeBaseline('stale', '2026-05-28T08:00:00.000Z')
    const todayCheckIn = [{
      id: 'today',
      context: 'daily' as const,
      comfort: 3,
      focusAreas: [],
      safetySignals: [],
      recordedAt: '2026-06-29T07:30:00.000Z',
    }]

    const aging = deriveBodyMirror(evidence({ ...agingBaseline, checkIns: todayCheckIn }), { now: NOW })
    const stale = deriveBodyMirror(evidence({ ...staleBaseline, checkIns: todayCheckIn }), { now: NOW })

    assert.equal(aging.status, 'current')
    assert.equal(aging.freshness.level, 'aging')
    assert.equal(stale.status, 'stale')
    assert.equal(stale.freshness.level, 'stale')
    assert.equal(stale.recommendation.mode, 'reassess')
  })

  it('pauses exercise recommendations for stop signals', () => {
    const baseline = completeBaseline()
    const result = deriveBodyMirror(evidence({
      ...baseline,
      checkIns: [{
        id: 'unsafe',
        context: 'daily',
        comfort: 1,
        focusAreas: ['lower_back'],
        safetySignals: ['radiating_pain', 'numbness'],
        recordedAt: '2026-06-29T07:45:00.000Z',
      }],
    }), { now: NOW })

    assert.equal(result.status, 'safety_hold')
    assert.equal(result.recommendation.mode, 'pause')
    assert.deepEqual(result.safety.signals, ['radiating_pain', 'numbness'])
  })

  it('selects a gentler quick session after a user feels worse post-session', () => {
    const baseline = completeBaseline()
    const result = deriveBodyMirror(evidence({
      ...baseline,
      checkIns: [{
        id: 'today',
        context: 'daily',
        comfort: 3,
        focusAreas: [],
        safetySignals: [],
        recordedAt: '2026-06-29T07:30:00.000Z',
      }],
      sessions: [{
        id: 'session',
        completedAt: '2026-06-28T12:00:00.000Z',
        durationSeconds: 900,
        isPartial: false,
        bodyFeelBefore: 'good',
        bodyFeelAfter: 'tight',
      }],
    }), { now: NOW })

    assert.equal(result.recommendation.mode, 'quick')
    assert.equal(result.recommendation.intensity, 'gentle')
    assert.equal(result.recommendation.adjustedForWorseFeeling, true)
  })

  it('compares comfort, mobility, and control only with the personal baseline', () => {
    const baseline = completeBaseline()
    const reassessment = assessment('reassessment', '2026-06-28T08:00:00.000Z', {
      kind: 'reassessment',
    })
    const current = baseline.observations.map((item, index) => observation(
      `current-${index}`,
      reassessment.id,
      item.movementKey,
      item.dimension,
      item.dimension === 'mobility' ? item.value + 6 : item.value - 0.08,
      {
        metricKey: item.metricKey,
        unit: item.unit,
        side: item.side,
        changeThreshold: item.changeThreshold,
        observedAt: reassessment.completedAt!,
      },
    ))

    const result = deriveBodyMirror(evidence({
      checkIns: [
        {
          id: 'baseline-checkin',
          context: 'baseline',
          comfort: 2,
          focusAreas: ['neck_shoulders'],
          safetySignals: [],
          recordedAt: baseline.assessments[0].completedAt!,
        },
        {
          id: 'today',
          context: 'daily',
          comfort: 4,
          focusAreas: ['neck_shoulders'],
          safetySignals: [],
          recordedAt: '2026-06-29T07:30:00.000Z',
        },
      ],
      assessments: [...baseline.assessments, reassessment],
      observations: [...baseline.observations, ...current],
    }), { now: NOW })

    assert.equal(result.dimensions.comfort.state, 'improved')
    assert.equal(result.dimensions.mobility.state, 'improved')
    assert.equal(result.dimensions.control.state, 'declined')
  })

  it('retains partial attempts as evidence without counting them as completed activity', () => {
    const baseline = completeBaseline()
    const result = deriveBodyMirror(evidence({
      ...baseline,
      sessions: [
        {
          id: 'complete',
          completedAt: '2026-06-29T06:00:00.000Z',
          durationSeconds: 600,
          isPartial: false,
          bodyFeelBefore: null,
          bodyFeelAfter: null,
        },
        {
          id: 'partial',
          completedAt: '2026-06-29T07:00:00.000Z',
          durationSeconds: 420,
          isPartial: true,
          bodyFeelBefore: 'tight',
          bodyFeelAfter: 'okay',
        },
      ],
    }), { now: NOW })

    assert.equal(result.activity.completedSessions, 1)
    assert.equal(result.activity.completedMinutes, 10)
    assert.equal(result.activity.partialAttempts, 1)
  })

  it('gives Home and Progress the same status, freshness, and dimension states', () => {
    const baseline = completeBaseline()
    const result = deriveBodyMirror(evidence({ ...baseline }), { now: NOW })
    const home = createHomeBodyMirrorModel(result)
    const progress = createProgressBodyMirrorModel(result)

    assert.equal(home.status, progress.status)
    assert.deepEqual(home.freshness, progress.freshness)
    assert.deepEqual(home.dimensionStates, progress.dimensionStates)
    assert.equal(home.resultId, progress.resultId)
  })
})
