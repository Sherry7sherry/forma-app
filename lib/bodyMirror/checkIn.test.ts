import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildBodyCheckInInsert } from './checkIn.js'

describe('buildBodyCheckInInsert', () => {
  it('builds an owned daily self-report row', () => {
    assert.deepEqual(buildBodyCheckInInsert({
      userId: 'user-1',
      comfort: 3,
      focusAreas: ['neck_shoulders'],
      safetySignals: [],
      recordedAt: '2026-06-29T08:00:00.000Z',
    }), {
      user_id: 'user-1',
      context: 'daily',
      comfort: 3,
      focus_areas: ['neck_shoulders'],
      safety_signals: [],
      recorded_at: '2026-06-29T08:00:00.000Z',
    })
  })

  it('rejects invalid comfort values and unknown safety signals', () => {
    assert.throws(() => buildBodyCheckInInsert({
      userId: 'user-1',
      comfort: 0,
      focusAreas: [],
      safetySignals: [],
    }), /Comfort must be an integer from 1 to 5/)

    assert.throws(() => buildBodyCheckInInsert({
      userId: 'user-1',
      comfort: 3,
      focusAreas: [],
      safetySignals: ['mystery_signal'],
    }), /Unknown safety signal/)
  })
})
