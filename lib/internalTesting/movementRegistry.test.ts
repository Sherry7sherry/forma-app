import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getExerciseTrackingOverrideNames,
  getFloorExerciseNames,
  getExerciseTrackingProfile,
} from '../exerciseTracking.js'
import {
  ASSESSMENT_TEST_MOVEMENTS,
  TESTABLE_MOVEMENTS,
  getTestableMovement,
} from './movementRegistry.js'

describe('movement registry', () => {
  it('covers every production floor exercise and tracking override', () => {
    const productionNames = new Set([
      ...getFloorExerciseNames(),
      ...getExerciseTrackingOverrideNames(),
    ])

    for (const name of productionNames) {
      assert.ok(
        TESTABLE_MOVEMENTS.some(entry => entry.kind === 'exercise' && entry.exerciseName === name),
        `${name} should resolve to a training registry entry`,
      )
    }
  })

  it('defines the three assessment movements with stable keys', () => {
    assert.deepEqual(
      ASSESSMENT_TEST_MOVEMENTS.map(entry => [entry.id, entry.assessmentMovementKey]),
      [
        ['assessment:side_arm_raise', 'side_arm_raise'],
        ['assessment:standing_roll_down', 'standing_roll_down'],
        ['assessment:seated_trunk_rotation', 'seated_trunk_rotation'],
      ],
    )
  })

  it('declares complete test metadata for every entry', () => {
    for (const entry of TESTABLE_MOVEMENTS) {
      assert.ok(entry.id)
      assert.ok(entry.displayName)
      assert.ok(['assessment', 'exercise'].includes(entry.kind))
      assert.ok(['standing', 'seated', 'supine', 'side-lying', 'prone', 'quadruped', 'full-body'].includes(entry.postureFamily))
      assert.ok(['automatic', 'manual', 'timed'].includes(entry.trackingMode))
      assert.ok(['portrait', 'landscape', 'either'].includes(entry.orientation))
      assert.ok(entry.capabilities.length > 0)
      assert.ok(entry.scenarios.length > 0)
      assert.ok(entry.scenarios.every(scenario => scenario.id && scenario.assertionType))
      assert.equal(getTestableMovement(entry.id), entry)
    }
  })

  it('keeps registry behavior consistent with production tracking profiles', () => {
    for (const entry of TESTABLE_MOVEMENTS.filter(entry => entry.kind === 'exercise')) {
      const profile = getExerciseTrackingProfile(
        entry.exerciseName,
        getFloorExerciseNames().includes(entry.exerciseName),
      )

      if (entry.trackingMode === 'automatic') {
        assert.ok(profile.engageThreshold > profile.returnThreshold)
      } else {
        assert.equal(
          entry.scenarios.some(scenario => scenario.id === 'automatic-count'),
          false,
          `${entry.displayName} cannot advertise automatic counting`,
        )
      }
    }
  })

  it('uses unique stable identifiers', () => {
    const ids = TESTABLE_MOVEMENTS.map(entry => entry.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})
