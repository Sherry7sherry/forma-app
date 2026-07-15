import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { missingRequiredBodyParts } from './landmarkGuidance.js'

function landmarks(visibility = 0.9) {
  return Array.from({ length: 33 }, () => ({ visibility }))
}

describe('missing landmark guidance', () => {
  it('groups two missing sides and names a single missing side', () => {
    const pose = landmarks()
    pose[11].visibility = 0.2
    pose[12].visibility = 0.2
    pose[28].visibility = 0.2

    assert.deepEqual(missingRequiredBodyParts({
      landmarks: pose,
      requiredLandmarks: [11, 12, 27, 28],
      minVisibility: 0.45,
    }), ['both shoulders', 'right ankle'])
  })

  it('orders missing regions by camera-placement priority', () => {
    const pose = landmarks()
    for (const index of [0, 15, 16, 23, 24, 25, 26]) pose[index].visibility = 0.1

    assert.deepEqual(missingRequiredBodyParts({
      landmarks: pose,
      requiredLandmarks: [15, 16, 25, 26, 23, 24, 0],
      minVisibility: 0.45,
    }), ['head', 'both hips', 'both knees', 'both wrists'])
  })

  it('uses the production threshold boundary and handles missing data safely', () => {
    const pose = landmarks()
    pose[23].visibility = 0.45

    assert.deepEqual(missingRequiredBodyParts({
      landmarks: pose,
      requiredLandmarks: [23],
      minVisibility: 0.45,
    }), [])
    assert.deepEqual(missingRequiredBodyParts({
      landmarks: [],
      requiredLandmarks: [0, 11, 12],
      minVisibility: 0.45,
    }), ['head', 'both shoulders'])
  })

  it('falls back safely for unknown required indices', () => {
    assert.deepEqual(missingRequiredBodyParts({
      landmarks: [],
      requiredLandmarks: [29, 30],
      minVisibility: 0.45,
    }), ['required keypoint'])
  })
})
