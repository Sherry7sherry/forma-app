import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextAssessmentScenario, nextExerciseScenario } from './assessmentSequence.js'

describe('assessment continuation sequence', () => {
  it('advances Arm Raise to Roll Down and then Spine Twist', () => {
    assert.match(nextAssessmentScenario('assessment:side_arm_raise') ?? '', /movement=assessment%3Astanding_roll_down/)
    assert.match(nextAssessmentScenario('assessment:standing_roll_down') ?? '', /movement=assessment%3Aseated_trunk_rotation/)
    assert.equal(nextAssessmentScenario('assessment:seated_trunk_rotation'), null)
  })

  it('advances exercise tests to the next exercise instead of returning home', () => {
    const next = nextExerciseScenario('exercise:glute-bridge')

    assert.ok(next)
    assert.match(next, /phase=full-run/)
    assert.doesNotMatch(next, /movement=exercise%3Aglute-bridge/)
  })
})
