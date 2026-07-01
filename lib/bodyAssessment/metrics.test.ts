import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BodyMirrorMovement } from '../bodyMirror/types'
import type { AssessmentPoseSample, PoseLandmark } from './types'
import { deriveMovementObservations } from './metrics'

function pose(overrides: Record<number, Partial<PoseLandmark>> = {}): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from(
    { length: 33 },
    () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.96 }),
  )
  const defaults: Record<number, PoseLandmark> = {
    11: { x: 0.42, y: 0.32, z: 0, visibility: 0.96 },
    12: { x: 0.58, y: 0.32, z: 0, visibility: 0.96 },
    13: { x: 0.38, y: 0.46, z: 0, visibility: 0.96 },
    14: { x: 0.62, y: 0.46, z: 0, visibility: 0.96 },
    15: { x: 0.36, y: 0.60, z: 0, visibility: 0.96 },
    16: { x: 0.64, y: 0.60, z: 0, visibility: 0.96 },
    23: { x: 0.44, y: 0.62, z: 0, visibility: 0.96 },
    24: { x: 0.56, y: 0.62, z: 0, visibility: 0.96 },
    25: { x: 0.45, y: 0.78, z: 0, visibility: 0.96 },
    26: { x: 0.55, y: 0.78, z: 0, visibility: 0.96 },
    27: { x: 0.45, y: 0.94, z: 0, visibility: 0.96 },
    28: { x: 0.55, y: 0.94, z: 0, visibility: 0.96 },
  }
  for (const [index, value] of Object.entries(defaults)) landmarks[Number(index)] = value
  for (const [index, value] of Object.entries(overrides)) {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...value }
  }
  return landmarks
}

function sample(capturedAt: number, overrides: Record<number, Partial<PoseLandmark>> = {}, bodyConfidence = 0.9): AssessmentPoseSample {
  return { capturedAt, bodyConfidence, landmarks: pose(overrides) }
}

function fixtureSamples(movement: BodyMirrorMovement): AssessmentPoseSample[] {
  if (movement === 'side_arm_raise') {
    return [
      sample(0, { 11: { x: 0.5 }, 12: { x: 0.52 }, 13: { x: 0.5, y: 0.47 }, 14: { x: 0.52, y: 0.47 }, 15: { x: 0.5, y: 0.62 }, 16: { x: 0.52, y: 0.62 } }),
      sample(500, { 11: { x: 0.5 }, 12: { x: 0.52 }, 13: { x: 0.48, y: 0.20 }, 14: { x: 0.50, y: 0.20 }, 15: { x: 0.46, y: 0.06 }, 16: { x: 0.48, y: 0.06 } }),
    ]
  }
  if (movement === 'standing_roll_down') {
    return [
      sample(0),
      sample(500, { 11: { y: 0.52 }, 12: { y: 0.52 }, 15: { y: 0.94 }, 16: { y: 0.94 } }),
    ]
  }
  return [
    sample(0),
    sample(500, { 11: { x: 0.47, z: -0.12 }, 12: { x: 0.53, z: 0.12 }, 23: { x: 0.445 }, 24: { x: 0.555 } }),
    sample(1000, { 11: { x: 0.47, z: 0.12 }, 12: { x: 0.53, z: -0.12 }, 23: { x: 0.445 }, 24: { x: 0.555 } }),
  ]
}

describe('deriveMovementObservations', () => {
  it('emits stable mobility and control contracts for every MVP movement', () => {
    const expected = {
      side_arm_raise: ['max_arm_elevation_deg', 'torso_drift_ratio'],
      standing_roll_down: ['normalized_wrist_descent', 'lateral_torso_drift_ratio'],
      seated_trunk_rotation: ['shoulder_rotation_range_ratio', 'pelvis_drift_ratio'],
    }

    for (const movement of Object.keys(expected) as BodyMirrorMovement[]) {
      const result = deriveMovementObservations(movement, fixtureSamples(movement))
      assert.equal(result.status, 'reliable')
      if (result.status !== 'reliable') continue
      assert.deepEqual(result.observations.map(item => item.metricKey), expected[movement])
      assert.deepEqual(new Set(result.observations.map(item => item.dimension)), new Set(['mobility', 'control']))
      assert.ok(result.observations.every(item => item.changeThreshold > 0 && item.confidence >= 0.7))
    }
  })

  it('normalizes whole-body translation out of movement values', () => {
    const original = deriveMovementObservations('standing_roll_down', fixtureSamples('standing_roll_down'))
    const translated = fixtureSamples('standing_roll_down').map(entry => ({
      ...entry,
      landmarks: entry.landmarks.map(point => ({ ...point, x: point.x + 0.11, y: point.y + 0.07 })),
    }))
    const shifted = deriveMovementObservations('standing_roll_down', translated)
    assert.equal(original.status, 'reliable')
    assert.equal(shifted.status, 'reliable')
    if (original.status !== 'reliable' || shifted.status !== 'reliable') return
    assert.ok(Math.abs(original.observations[0].value - shifted.observations[0].value) < 0.001)
  })

  it('rejects low confidence, missing landmarks, and insufficient movement range', () => {
    const lowConfidence = fixtureSamples('side_arm_raise').map(entry => ({ ...entry, bodyConfidence: 0.69 }))
    assert.equal(deriveMovementObservations('side_arm_raise', lowConfidence).status, 'low_confidence')

    const missingWrists = fixtureSamples('standing_roll_down').map(entry => ({
      ...entry,
      landmarks: entry.landmarks.map((point, index) => index === 15 || index === 16 ? { ...point, visibility: 0.1 } : point),
    }))
    assert.equal(deriveMovementObservations('standing_roll_down', missingWrists).status, 'low_confidence')

    const still = [sample(0), sample(500), sample(1000)]
    assert.equal(deriveMovementObservations('seated_trunk_rotation', still).status, 'low_confidence')
  })
})
