import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveSessionBodyPolicy } from './sessionPolicy'
import type { BodyMirrorResult, BodyMirrorStatus, DimensionState } from './types'

function result(status: BodyMirrorStatus, mobility: DimensionState = 'baseline', control: DimensionState = 'baseline'): BodyMirrorResult {
  const dimension = (key: 'comfort' | 'mobility' | 'control', state: DimensionState) => ({
    key,
    state,
    label: key,
    summary: '',
    detail: '',
    evidenceCount: 0,
    asOf: null,
  })
  return {
    resultId: status,
    status,
    confidenceNotice: 'none',
    freshness: { level: 'none', asOf: null, label: '' },
    checkInAsOf: null,
    dimensions: {
      comfort: dimension('comfort', 'baseline'),
      mobility: dimension('mobility', mobility),
      control: dimension('control', control),
    },
    recommendation: {
      mode: 'quick', intensity: 'gentle', title: '', reason: '', durationMinutes: 4,
      durationSeconds: null, adjustedForWorseFeeling: false,
    },
    safety: { shouldPause: status === 'safety_hold', signals: status === 'safety_hold' ? ['sharp_pain'] : [] },
    activity: { completedSessions: 0, completedMinutes: 0, currentStreak: 0, partialAttempts: 0 },
  }
}

describe('deriveSessionBodyPolicy', () => {
  it('prompts for missing movement evidence but allows an explicit skip', () => {
    assert.equal(deriveSessionBodyPolicy(result('no_data', 'no_data', 'no_data')), 'prompt_assessment')
    assert.equal(deriveSessionBodyPolicy(result('low_confidence', 'no_data', 'no_data')), 'prompt_assessment')
  })

  it('hard-blocks current safety signals and otherwise allows the session', () => {
    assert.equal(deriveSessionBodyPolicy(result('safety_hold')), 'block_safety')
    assert.equal(deriveSessionBodyPolicy(result('current')), 'allow')
    assert.equal(deriveSessionBodyPolicy(result('stale')), 'allow')
  })
})
