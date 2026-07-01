import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatSafetySignals } from './safetySignals.js'

describe('formatSafetySignals', () => {
  it('formats one stop signal in plain language', () => {
    assert.equal(formatSafetySignals(['sharp_pain']), 'Sharp pain')
  })

  it('joins multiple stop signals readably', () => {
    assert.equal(
      formatSafetySignals(['radiating_pain', 'numbness']),
      'Radiating pain and numbness',
    )
  })
})
