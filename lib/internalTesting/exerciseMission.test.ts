import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deriveExerciseMissionState,
  missionEventForQuickAction,
  type ExerciseMissionPoseSnapshot,
} from './exerciseMission.js'
import type { ExerciseTestableMovement } from './types.js'

const automaticMovement: ExerciseTestableMovement = {
  id: 'exercise:glute-bridge',
  kind: 'exercise',
  displayName: 'Glute Bridge',
  exerciseName: 'Glute Bridge',
  postureFamily: 'supine',
  trackingMode: 'automatic',
  orientation: 'landscape',
  capabilities: ['calibration', 'repetition-counting', 'form-feedback'],
  scenarios: [{ id: 'automatic-count', label: 'Automatic count', assertionType: 'automatic-count' }],
}

const manualMovement: ExerciseTestableMovement = {
  ...automaticMovement,
  id: 'exercise:pelvic-floor-activation',
  displayName: 'Pelvic Floor Activation',
  exerciseName: 'Pelvic Floor Activation',
  trackingMode: 'manual',
  capabilities: ['calibration', 'form-feedback'],
  scenarios: [{ id: 'manual-count', label: 'Manual count', assertionType: 'manual-count' }],
}

function pose(overrides: Partial<ExerciseMissionPoseSnapshot> = {}): ExerciseMissionPoseSnapshot {
  return {
    framingStatus: 'full-body',
    bodyConfidence: 0.86,
    visibleLandmarks: 26,
    trackedLandmarks: 20,
    detectionFps: 10.4,
    deviceClass: 'phone',
    orientation: 'landscape',
    feedbackTypes: ['good'],
    ...overrides,
  }
}

describe('exercise mission state', () => {
  it('turns calibrating diagnostics into a clear ready or stuck state', () => {
    const waiting = deriveExerciseMissionState({
      movement: automaticMovement,
      phase: 'calibrating',
      repeats: 3,
      pose: pose({ framingStatus: 'partial', bodyConfidence: 0.35, visibleLandmarks: 9, trackedLandmarks: 4 }),
    })
    assert.equal(waiting.status, 'waiting')
    assert.equal(waiting.primaryMetric.label, 'Calibration')
    assert.match(waiting.primaryMetric.value, /Needs body/)
    assert.equal(waiting.canLogSuccess, false)
    assert.ok(waiting.checklist.some(item => item.key === 'camera' && item.state === 'done'))
    assert.ok(waiting.checklist.some(item => item.key === 'calibration' && item.state === 'active'))

    const ready = deriveExerciseMissionState({
      movement: automaticMovement,
      phase: 'calibrating',
      repeats: 3,
      pose: pose(),
    })
    assert.equal(ready.status, 'ready')
    assert.equal(ready.primaryMetric.value, 'Ready')
    assert.equal(ready.canLogSuccess, true)
    assert.ok(ready.checklist.some(item => item.key === 'calibration' && item.state === 'done'))
  })

  it('uses the same Camera, Calibration, Count standards for every movement kind', () => {
    const exercise = deriveExerciseMissionState({
      movement: automaticMovement,
      phase: 'exercising',
      repeats: 3,
      pose: pose(),
    })
    assert.deepEqual(exercise.checklist.map(item => item.key), ['camera', 'calibration', 'count'])
    assert.ok(exercise.checklist.some(item => item.label.includes('Camera') && item.label.includes('Pass')))
    assert.ok(exercise.checklist.some(item => item.label.includes('Calibration') && item.label.includes('Pass')))
    assert.ok(exercise.checklist.some(item => item.label.includes('Count')))

    const assessment = deriveExerciseMissionState({
      movement: { ...automaticMovement, id: 'assessment:side_arm_raise', kind: 'assessment', trackingMode: 'manual' } as never,
      phase: 'capture',
      repeats: 1,
      pose: pose(),
    })
    assert.deepEqual(assessment.checklist.map(item => item.key), ['camera', 'calibration', 'count'])
  })

  it('accepts production tracking profile coverage when generic full-body framing is conservative', () => {
    const ready = deriveExerciseMissionState({
      movement: automaticMovement,
      phase: 'calibrating',
      repeats: 3,
      pose: pose({ framingStatus: 'partial', bodyConfidence: 0.72, visibleLandmarks: 7, trackedLandmarks: 9 }),
    })

    assert.equal(ready.status, 'ready')
    assert.equal(ready.canLogSuccess, true)
  })

  it('explains exercise count expectations without creating a Test Lab-only movement engine', () => {
    const automatic = deriveExerciseMissionState({
      movement: automaticMovement,
      phase: 'exercising',
      repeats: 4,
      pose: pose(),
    })
    assert.equal(automatic.status, 'observing')
    assert.equal(automatic.countMode, 'automatic')
    assert.equal(automatic.primaryMetric.value, '4 reps')
    assert.match(automatic.guidance, /production auto-count/i)
    assert.match(automatic.guardrail, /No Test Lab-only counting/)

    const manual = deriveExerciseMissionState({
      movement: manualMovement,
      phase: 'exercising',
      repeats: 2,
      pose: pose(),
    })
    assert.equal(manual.countMode, 'manual')
    assert.match(manual.guidance, /tester-observed count/i)
  })

  it('records quick annotations as isolated internal events', () => {
    const count = missionEventForQuickAction('count-observed', automaticMovement, 'exercising', 2)
    assert.equal(count.eventType, 'count')
    assert.deepEqual(count.data, {
      action: 'count-observed',
      movementId: 'exercise:glute-bridge',
      phase: 'exercising',
      outcome: 'note',
      observedCount: 2,
      productionEvidence: false,
      synthetic: true,
    })

    const blocker = missionEventForQuickAction('calibration-stuck', automaticMovement, 'calibrating')
    assert.equal(blocker.eventType, 'blocker')
    assert.equal(blocker.data.productionEvidence, false)
    assert.equal(blocker.data.synthetic, true)
  })

  it('records count pass and zero-count diagnostics as internal-only evidence', () => {
    const pass = missionEventForQuickAction('count-pass', automaticMovement, 'exercising', undefined, {
      aiRepCount: 3,
      targetReps: 3,
      aiRepPhase: 'rep_counted',
      delta: 0.02,
      engageThreshold: 0.16,
      returnThreshold: 0.065,
      trackingMode: 'automatic',
    })
    assert.equal(pass.eventType, 'count')
    assert.equal(pass.data.action, 'count-pass')
    assert.equal(pass.data.outcome, 'pass')
    assert.equal(pass.data.aiRepCount, 3)
    assert.equal(pass.data.productionEvidence, false)

    const zero = missionEventForQuickAction('ai-count-zero', automaticMovement, 'exercising', undefined, {
      aiRepCount: 0,
      targetReps: 3,
      aiRepPhase: 'waiting_for_engaged_phase',
      delta: 0.01,
      engageThreshold: 0.16,
      returnThreshold: 0.065,
      trackingMode: 'automatic',
    })
    assert.equal(zero.eventType, 'blocker')
    assert.equal(zero.data.action, 'ai-count-zero')
    assert.equal(zero.data.reason, 'ai-count-zero')
    assert.equal(zero.data.aiRepPhase, 'waiting_for_engaged_phase')
    assert.equal(zero.data.synthetic, true)
  })
})
