import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { screenAssessment } from '../assessmentIntake/index.js'
import type { AssessmentIntake } from '../assessmentIntake/index.js'
import type { BodyMirrorResult, DimensionState } from '../bodyMirror/types.js'
import { evaluateCoaching } from './evaluateCoaching.js'
import type { CoachingInput, CoachingObservation, ExerciseProfile } from './types.js'

const baseIntake: AssessmentIntake = {
  version: 1,
  goals: ['reduce_sitting_stiffness'],
  focusRegions: ['neck_shoulders'],
  sensation: 'tight',
  injuryStatus: 'none',
  injuryRegions: [],
  movementFrequency: 'rarely',
  workPattern: 'sitting_over_8h',
  availableMinutes: 5,
  safetySignals: [],
}

const exercises: ExerciseProfile[] = [
  {
    id: 'advanced-overhead',
    focusAreas: ['shoulder_mobility'],
    painSensitiveRegions: ['shoulders'],
    difficulty: 'advanced',
  },
  {
    id: 'gentle-trunk-control',
    focusAreas: ['trunk_control'],
    painSensitiveRegions: [],
    difficulty: 'gentle',
  },
]

function bodyMirror(shouldPause = false): BodyMirrorResult {
  const dimension = (key: 'comfort' | 'mobility' | 'control', state: DimensionState) => ({
    key, state, label: key, summary: '', detail: '', evidenceCount: 0, asOf: null,
  })
  return {
    resultId: shouldPause ? 'stop' : 'allow',
    status: shouldPause ? 'safety_hold' : 'current',
    confidenceNotice: 'none',
    freshness: { level: 'fresh', asOf: '2026-07-03T00:00:00.000Z', label: 'Current' },
    checkInAsOf: '2026-07-03T00:00:00.000Z',
    dimensions: {
      comfort: dimension('comfort', 'baseline'),
      mobility: dimension('mobility', 'baseline'),
      control: dimension('control', 'baseline'),
    },
    recommendation: {
      mode: shouldPause ? 'pause' : 'quick',
      intensity: shouldPause ? 'none' : 'gentle',
      title: '', reason: '', durationMinutes: shouldPause ? null : 5,
      durationSeconds: null, adjustedForWorseFeeling: false,
    },
    safety: { shouldPause, signals: shouldPause ? ['sharp_pain'] : [] },
    activity: { completedSessions: 0, completedMinutes: 0, currentStreak: 0, partialAttempts: 0 },
  }
}

function input(
  intakeOverrides: Partial<AssessmentIntake> = {},
  observations: CoachingObservation[] = [],
): CoachingInput {
  const intake = { ...baseIntake, ...intakeOverrides }
  return {
    intake,
    route: screenAssessment(intake),
    bodyMirror: bodyMirror(),
    observations,
    exercises,
  }
}

describe('evaluateCoaching', () => {
  it('never lets a preference override stop', () => {
    const decision = evaluateCoaching(input({ safetySignals: ['sharp_pain'] }))

    assert.equal(decision.safety, 'stop')
    assert.deepEqual(decision.plan.preferredExerciseIds, [])
    assert.ok(decision.trace.some(item => item.ruleId === 'SAFETY_STOP'))
  })

  it('also stops when the shared Body Mirror safety state is active', () => {
    const coachingInput = input()
    coachingInput.bodyMirror = bodyMirror(true)

    assert.equal(evaluateCoaching(coachingInput).safety, 'stop')
  })

  it('creates a torso-drift insight only from reliable existing evidence', () => {
    const reliable = evaluateCoaching(input({}, [{
      id: 'obs-1', metricKey: 'torso_drift_ratio', value: 0.16, confidence: 0.88,
    }]))
    const unreliable = evaluateCoaching(input({}, [{
      id: 'obs-2', metricKey: 'torso_drift_ratio', value: 0.16, confidence: 0.69,
    }]))

    assert.equal(reliable.insights[0]?.claimKey, 'arm_raise_torso_drift')
    assert.deepEqual(reliable.insights[0]?.evidenceIds, ['obs-1'])
    assert.deepEqual(unreliable.insights, [])
  })

  it('excludes before ranking', () => {
    const decision = evaluateCoaching(input({
      injuryRegions: ['right_shoulder'],
      injuryStatus: 'recovering',
    }))

    assert.ok(decision.plan.excludedExerciseIds.includes('advanced-overhead'))
    assert.ok(!decision.plan.preferredExerciseIds.includes('advanced-overhead'))
  })
})
