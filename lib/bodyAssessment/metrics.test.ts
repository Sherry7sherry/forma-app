import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BodyMirrorMovement } from '../bodyMirror/types'
import type { AssessmentPoseSample, PoseLandmark } from './types'
import { deriveMovementObservations, evaluateMovementEvidence } from './metrics'

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

function phasedSample(
  capturedAt: number,
  phase: 'baseline' | 'movement',
  overrides: Record<number, Partial<PoseLandmark>> = {},
  bodyConfidence = 0.9,
): AssessmentPoseSample {
  return { ...sample(capturedAt, overrides, bodyConfidence), phase }
}

function fixtureSamples(movement: BodyMirrorMovement): AssessmentPoseSample[] {
  if (movement === 'side_arm_raise') {
    const cycle = [
      sample(0, { 11: { x: 0.5 }, 12: { x: 0.52 }, 13: { x: 0.5, y: 0.47 }, 14: { x: 0.52, y: 0.47 }, 15: { x: 0.5, y: 0.62 }, 16: { x: 0.52, y: 0.62 } }),
      sample(500, { 11: { x: 0.5 }, 12: { x: 0.52 }, 13: { x: 0.48, y: 0.20 }, 14: { x: 0.50, y: 0.20 }, 15: { x: 0.46, y: 0.06 }, 16: { x: 0.48, y: 0.06 } }),
    ]
    return Array.from({ length: 10 }, (_, index) => ({ ...cycle[index % 2], capturedAt: index * 200 }))
  }
  if (movement === 'standing_roll_down') {
    const cycle = [
      phasedSample(0, 'movement'),
      phasedSample(500, 'movement', { 11: { y: 0.52 }, 12: { y: 0.52 }, 15: { y: 0.94 }, 16: { y: 0.94 } }),
    ]
    const baseline = Array.from({ length: 3 }, (_, index) => phasedSample(index * 200, 'baseline'))
    const movementSamples = Array.from({ length: 10 }, (_, index) => ({ ...cycle[index % 2], capturedAt: 800 + index * 200 }))
    return [...baseline, ...movementSamples]
  }
  const cycle = [
    sample(0),
    sample(500, { 11: { x: 0.47, z: -0.12 }, 12: { x: 0.53, z: 0.12 }, 23: { x: 0.445 }, 24: { x: 0.555 } }),
    sample(1000, { 11: { x: 0.47, z: 0.12 }, 12: { x: 0.53, z: -0.12 }, 23: { x: 0.445 }, 24: { x: 0.555 } }),
  ]
  return Array.from({ length: 12 }, (_, index) => ({ ...cycle[index % 3], capturedAt: index * 200 }))
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

  it('ignores preparation frames and a small number of transient tracking drops', () => {
    const good = Array.from({ length: 10 }, (_, index) => ({
      ...fixtureSamples('side_arm_raise')[index % 2],
      capturedAt: 1_000 + index * 200,
    }))
    const preparation = Array.from({ length: 5 }, (_, index) => sample(index * 200, {}, 0.25))
    const transientDrop = sample(3_200, { 11: { visibility: 0.1 }, 12: { visibility: 0.1 } }, 0.4)
    const result = deriveMovementObservations('side_arm_raise', [...preparation, ...good, transientDrop])
    assert.equal(result.status, 'reliable')
  })

  it('rejects a capture when bad frames are the majority', () => {
    const good = Array.from({ length: 6 }, (_, index) => ({
      ...fixtureSamples('standing_roll_down')[index % 2],
      capturedAt: index * 200,
    }))
    const obscured = Array.from({ length: 10 }, (_, index) => sample(
      2_000 + index * 200,
      { 15: { visibility: 0.1 }, 16: { visibility: 0.1 }, 27: { visibility: 0.1 }, 28: { visibility: 0.1 } },
      0.55,
    ))
    const result = deriveMovementObservations('standing_roll_down', [...good, ...obscured])
    assert.equal(result.status, 'low_confidence')
    if (result.status === 'low_confidence') assert.equal(result.reason, 'landmarks')
  })

  it('accepts side-view arm overlap when the torso and one complete arm remain readable', () => {
    const samples = Array.from({ length: 10 }, (_, index) => {
      const base = fixtureSamples('side_arm_raise')[index % 2]
      return {
        ...base,
        capturedAt: index * 200,
        landmarks: base.landmarks.map((point, landmarkIndex) =>
          [14, 16].includes(landmarkIndex) ? { ...point, visibility: 0.28 } : point),
      }
    })
    assert.equal(deriveMovementObservations('side_arm_raise', samples).status, 'reliable')
  })

  it('requires enough valid frames and movement range before evidence is ready', () => {
    const arbitrary = Array.from({ length: 8 }, (_, index) => sample(index * 200))
    const notReady = evaluateMovementEvidence('side_arm_raise', arbitrary)
    assert.equal(notReady.validSampleCount, 8)
    assert.equal(notReady.ready, false)
    assert.equal(notReady.reason, 'range')

    const moving = Array.from({ length: 10 }, (_, index) => ({
      ...fixtureSamples('side_arm_raise')[index % 2],
      capturedAt: index * 200,
    }))
    assert.equal(evaluateMovementEvidence('side_arm_raise', moving).ready, true)
  })

  it('accepts roll down when the far wrist and ankle overlap but one complete side chain remains readable', () => {
    const samples = fixtureSamples('standing_roll_down').map(entry => ({
      ...entry,
      landmarks: entry.landmarks.map((point, index) =>
        [16, 28].includes(index) ? { ...point, visibility: 0.25 } : point),
    }))
    assert.equal(evaluateMovementEvidence('standing_roll_down', samples).ready, true)
    assert.equal(deriveMovementObservations('standing_roll_down', samples).status, 'reliable')
  })

  it('rejects roll down when neither ankle or neither wrist is persistently readable', () => {
    for (const hidden of [[27, 28], [15, 16]]) {
      const samples = fixtureSamples('standing_roll_down').map(entry => ({
        ...entry,
        landmarks: entry.landmarks.map((point, index) =>
          hidden.includes(index) ? { ...point, visibility: 0.2 } : point),
      }))
      const evidence = evaluateMovementEvidence('standing_roll_down', samples)
      assert.equal(evidence.ready, false)
      assert.equal(evidence.reason, 'landmarks')
    }
  })

  it('requires an explicit neutral roll-down baseline before evaluating range', () => {
    const withoutBaseline = fixtureSamples('standing_roll_down').map(entry => ({ ...entry, phase: 'movement' as const }))
    const evidence = evaluateMovementEvidence('standing_roll_down', withoutBaseline)
    assert.equal(evidence.ready, false)
    assert.equal(evidence.reason, 'baseline_missing')
  })

  it('uses neutral baseline frames even when movement samples begin already bent', () => {
    const baseline = Array.from({ length: 3 }, (_, index) => phasedSample(index * 200, 'baseline'))
    const bent = Array.from({ length: 8 }, (_, index) => phasedSample(
      800 + index * 200,
      'movement',
      { 11: { y: 0.52 }, 12: { y: 0.52 }, 15: { y: 0.94 }, 16: { y: 0.94 } },
    ))
    assert.equal(evaluateMovementEvidence('standing_roll_down', [...baseline, ...bent]).ready, true)
  })

  it('accepts a gentle neutral-left-right seated rotation', () => {
    const cycle = [
      sample(0),
      sample(200, { 11: { z: -0.05 }, 12: { z: 0.05 } }),
      sample(400, { 11: { z: 0.05 }, 12: { z: -0.05 } }),
    ]
    const samples = Array.from({ length: 12 }, (_, index) => ({ ...cycle[index % 3], capturedAt: index * 200 }))
    assert.equal(evaluateMovementEvidence('seated_trunk_rotation', samples).ready, true)
  })

  it('rejects stillness, depth jitter, and only a small one-sided seated rotation', () => {
    const cases = [
      Array.from({ length: 10 }, (_, index) => sample(index * 200)),
      Array.from({ length: 10 }, (_, index) => sample(index * 200, {
        11: { z: index % 2 ? -0.004 : 0.004 },
        12: { z: index % 2 ? 0.004 : -0.004 },
      })),
      Array.from({ length: 10 }, (_, index) => sample(index * 200, {
        11: { z: index < 5 ? 0 : -0.008 },
        12: { z: index < 5 ? 0 : 0.008 },
      })),
    ]
    for (const samples of cases) {
      const evidence = evaluateMovementEvidence('seated_trunk_rotation', samples)
      assert.equal(evidence.ready, false)
      assert.equal(evidence.reason, 'range')
    }
  })

  it('tolerates a few transient seated shoulder or hip drops but rejects persistent loss', () => {
    const good = fixtureSamples('seated_trunk_rotation')
    const transient = good.map((entry, index) => index < 2 ? {
      ...entry,
      landmarks: entry.landmarks.map((point, landmarkIndex) =>
        landmarkIndex === 11 ? { ...point, visibility: 0.2 } : point),
    } : entry)
    assert.equal(evaluateMovementEvidence('seated_trunk_rotation', transient).ready, true)

    const persistent = good.map((entry, index) => index < 8 ? {
      ...entry,
      landmarks: entry.landmarks.map((point, landmarkIndex) =>
        landmarkIndex === 23 ? { ...point, visibility: 0.2 } : point),
    } : entry)
    const evidence = evaluateMovementEvidence('seated_trunk_rotation', persistent)
    assert.equal(evidence.ready, false)
    assert.equal(evidence.reason, 'landmarks')
  })
})
