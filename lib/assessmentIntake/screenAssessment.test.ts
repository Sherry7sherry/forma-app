import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { screenAssessment } from './screenAssessment.js'
import type { AssessmentIntake } from './types.js'

const base: AssessmentIntake = {
  version: 1,
  goals: ['reduce_sitting_stiffness'],
  focusRegions: ['neck_shoulders'],
  sensation: 'tight',
  injuryStatus: 'none',
  injuryRegions: [],
  movementFrequency: 'rarely',
  workPattern: 'sitting_over_8h',
  availableMinutes: 5,
  safetySignals: [],
}

describe('screenAssessment', () => {
  it('routes a normal intake to standard assessment', () => {
    assert.equal(screenAssessment(base).mode, 'standard')
  })

  it('modifies but does not stop for a recovered shoulder history', () => {
    const result = screenAssessment({
      ...base,
      injuryStatus: 'recovered',
      injuryRegions: ['right_shoulder'],
    })

    assert.equal(result.mode, 'modified')
    assert.ok(result.constraints.some(item => item.kind === 'optional_single_arm_compare'))
  })

  it('reduces roll-down range for a recovering back history', () => {
    const result = screenAssessment({
      ...base,
      injuryStatus: 'recovering',
      injuryRegions: ['lower_back'],
    })

    assert.equal(result.mode, 'modified')
    assert.ok(result.constraints.some(item =>
      item.kind === 'reduce_range' && item.movement === 'standing_roll_down'))
  })

  it('stops for every approved current stop signal', () => {
    for (const signal of ['sharp_pain', 'numbness', 'radiating_pain', 'dizziness', 'professional_pause'] as const) {
      const result = screenAssessment({ ...base, safetySignals: [signal] })
      assert.equal(result.mode, 'stop')
      assert.deepEqual(result.reasons.map(reason => reason.ruleId), ['SAFETY_CURRENT_STOP_SIGNAL'])
    }
  })

  it('stops for a current numb or radiating sensation even without explicit safety flags', () => {
    const result = screenAssessment({ ...base, sensation: 'numb_or_radiating' })

    assert.equal(result.mode, 'stop')
    assert.deepEqual(result.constraints, [])
  })
})
