import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getExerciseTrackingProfile } from './exerciseTracking.js'

describe('getExerciseTrackingProfile', () => {
  it('returns a specialized profile for known movements', () => {
    const profile = getExerciseTrackingProfile('Cat-Cow Stretch', true, 'reps')

    assert.equal(profile.cameraOrientation, 'landscape')
    assert.deepEqual(profile.landmarks, [0, 11, 12, 23, 24, 25, 26])
    assert.equal(profile.mode, 'auto')
  })

  it('marks subtle internal movements for manual counting', () => {
    assert.equal(getExerciseTrackingProfile('Pelvic Floor Activation', true, 'reps').mode, 'manual')
  })

  it('uses a tolerant floor fallback for newly designed exercises', () => {
    const profile = getExerciseTrackingProfile('Future Mat Movement', true, 'reps')

    assert.equal(profile.cameraOrientation, 'landscape')
    assert.ok(profile.minVisibleRatio < 0.7)
    assert.ok(profile.trackingGraceMs >= 1_500)
  })
})
