import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getExerciseTrackingProfile } from '../exerciseTracking.js'
import {
  createProductionRepCounterState,
  processProductionRepPose,
} from './productionRepCounter.js'
import type { PoseLandmark } from '../poseTracking.js'

function basePose(): PoseLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0.5 + ((index % 4) - 1.5) * 0.035,
    y: 0.5 + (index % 7) * 0.025,
    visibility: 0.95,
  })).map((point, index) => {
    const overrides: Record<number, Partial<PoseLandmark>> = {
      0: { x: 0.5, y: 0.18 },
      11: { x: 0.38, y: 0.34 },
      12: { x: 0.62, y: 0.34 },
      23: { x: 0.4, y: 0.56 },
      24: { x: 0.6, y: 0.56 },
      25: { x: 0.36, y: 0.76 },
      26: { x: 0.64, y: 0.76 },
      27: { x: 0.35, y: 0.9 },
      28: { x: 0.65, y: 0.9 },
    }
    return { ...point, ...overrides[index] }
  })
}

function bridgeLift(): PoseLandmark[] {
  const lifted = basePose()
  lifted[23] = { ...lifted[23], y: 0.42 }
  lifted[24] = { ...lifted[24], y: 0.42 }
  return lifted
}

describe('production rep counter', () => {
  it('counts a production auto-rep after baseline, movement, and return', () => {
    const trackingProfile = getExerciseTrackingProfile('Glute Bridge', true)
    let state = createProductionRepCounterState({ mode: trackingProfile.mode, targetReps: 3 })

    let result = processProductionRepPose(state, {
      framingStatus: 'full-body',
      landmarks: basePose(),
      bodyConfidence: 0.92,
    }, { exerciseName: 'Glute Bridge', trackingProfile, targetReps: 3, nowMs: 1_000 })
    state = result.state
    assert.equal(state.phase, 'ready_for_baseline')

    result = processProductionRepPose(state, {
      framingStatus: 'full-body',
      landmarks: basePose(),
      bodyConfidence: 0.92,
    }, { exerciseName: 'Glute Bridge', trackingProfile, targetReps: 3, nowMs: 1_100 })
    state = result.state
    assert.equal(state.phase, 'waiting_for_engaged_phase')

    result = processProductionRepPose(state, {
      framingStatus: 'full-body',
      landmarks: bridgeLift(),
      bodyConfidence: 0.92,
    }, { exerciseName: 'Glute Bridge', trackingProfile, targetReps: 3, nowMs: 1_250 })
    state = result.state
    assert.equal(state.phase, 'waiting_for_return_phase')

    result = processProductionRepPose(state, {
      framingStatus: 'full-body',
      landmarks: basePose(),
      bodyConfidence: 0.92,
    }, { exerciseName: 'Glute Bridge', trackingProfile, targetReps: 3, nowMs: 2_100 })
    state = result.state

    assert.equal(state.phase, 'rep_counted')
    assert.equal(state.repCount, 1)
    assert.equal(state.repFlash, true)
    assert.equal(result.events.some((event: { type: string; data: { repCount?: number } }) => event.type === 'count' && event.data.repCount === 1), true)
  })

  it('marks manual exercises as unsupported instead of inventing a Test Lab counter', () => {
    const trackingProfile = getExerciseTrackingProfile('Pelvic Floor Activation', true)
    const state = createProductionRepCounterState({ mode: trackingProfile.mode, targetReps: 4 })

    assert.equal(state.phase, 'unsupported_exercise')
    assert.equal(state.repCount, 0)
  })
})
