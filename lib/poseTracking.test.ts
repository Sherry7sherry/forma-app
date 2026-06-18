import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hasTrackingCoverage,
  isWithinTrackingGrace,
  normalizedPoseDistance,
  type PoseLandmark,
} from './poseTracking.js'

function landmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0.35 + (index % 4) * 0.08,
    y: 0.15 + Math.floor(index / 4) * 0.07,
    visibility: 0.95,
  }))
}

describe('hasTrackingCoverage', () => {
  const indices = [11, 12, 13, 14, 23, 24, 25, 26, 27, 28]

  it('tolerates a few occluded distal landmarks', () => {
    const pose = landmarks()
    pose[13].visibility = 0.1
    pose[27].visibility = 0.1

    assert.equal(hasTrackingCoverage(pose, indices, {
      minVisibility: 0.5,
      minVisibleRatio: 0.7,
      minVisibleLandmarks: 6,
    }), true)
  })

  it('rejects a torso-only reading for a full-body profile', () => {
    const pose = landmarks()
    for (const index of [13, 14, 25, 26, 27, 28]) pose[index].visibility = 0.1

    assert.equal(hasTrackingCoverage(pose, indices, {
      minVisibility: 0.5,
      minVisibleRatio: 0.7,
      minVisibleLandmarks: 6,
    }), false)
  })
})

describe('normalizedPoseDistance', () => {
  const indices = [11, 12, 23, 24, 25, 26]

  it('ignores whole-body translation in the camera frame', () => {
    const baseline = landmarks()
    const translated = baseline.map(point => ({ ...point, x: point.x + 0.12, y: point.y + 0.08 }))

    assert.ok(normalizedPoseDistance(translated, baseline, indices, 0.5) < 0.001)
  })

  it('detects movement relative to the torso scale', () => {
    const baseline = landmarks()
    const moved = baseline.map(point => ({ ...point }))
    moved[25].y += 0.12
    moved[26].y += 0.12

    assert.ok(normalizedPoseDistance(moved, baseline, indices, 0.5) > 0.12)
  })
})

describe('isWithinTrackingGrace', () => {
  it('keeps the current rep cycle through a brief tracking dip', () => {
    assert.equal(isWithinTrackingGrace(10_000, 11_200, 1_500), true)
    assert.equal(isWithinTrackingGrace(10_000, 11_600, 1_500), false)
  })
})
