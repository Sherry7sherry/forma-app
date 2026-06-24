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

const NEW_EXERCISE_NAMES = [
  'Chest Lift',
  'Glute Bridge',
  'Dead Bug',
  'Femur Arcs',
  'Bent Knee Opening',
  'Supine Knee Sways',
  'Arm Arcs',
  'Assisted Roll Up',
  'Roll Up',
  'Side Kick',
  'Prone Press Up',
  'Book Opening',
  'Spine Stretch Forward',
  'Hundred Prep',
  'Mermaid Stretch',
  'Quadruped Rock Back',
  'Leg Pull Front Prep',
  'Standing Roll Down',
  'Swan',
  'Spine Twist',
  'Single Leg Kick',
  'Saw',
  'Leg Pull Back',
  'Side Lift',
  'Single Leg Stretch',
  'Criss Cross',
  'Single Leg Circle',
  'Double Leg Kick',
  'Double Leg Stretch',
  'Pilates Push Up',
] as const

describe('replacement exercise tracking profiles', () => {
  it('has an explicit profile for every replacement exercise', () => {
    for (const exerciseName of NEW_EXERCISE_NAMES) {
      const profile = getExerciseTrackingProfile(exerciseName, true, 'reps')

      assert.ok(profile.landmarks.length > 0, `${exerciseName} should define landmarks`)
      assert.ok(profile.engageThreshold > profile.returnThreshold, `${exerciseName} should have usable thresholds`)
    }
  })

  it('uses stricter coverage for full-body peak actions', () => {
    for (const exerciseName of ['Leg Pull Front Prep', 'Leg Pull Back', 'Pilates Push Up']) {
      const profile = getExerciseTrackingProfile(exerciseName, false, 'reps')

      assert.equal(profile.cameraOrientation, 'landscape')
      assert.ok(profile.minVisibleRatio >= 0.7)
      assert.ok(profile.minVisibleLandmarks >= 6)
    }
  })

  it('keeps small floor movements tolerant enough to acquire tracking', () => {
    for (const exerciseName of ['Chest Lift', 'Femur Arcs', 'Bent Knee Opening']) {
      const profile = getExerciseTrackingProfile(exerciseName, true, 'reps')

      assert.equal(profile.cameraOrientation, 'landscape')
      assert.ok(profile.minVisibleRatio <= 0.6)
      assert.ok(profile.engageThreshold <= 0.14)
    }
  })
})
