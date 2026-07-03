import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AssessmentIntake, AssessmentRoute } from './types.js'
import {
  GUEST_ASSESSMENT_KEY,
  clearGuestAssessment,
  decodeGuestAssessment,
  encodeGuestAssessment,
  readGuestAssessment,
  writeGuestAssessment,
  type GuestAssessmentPayload,
  type GuestAssessmentStorage,
} from './guestState.js'

const intake: AssessmentIntake = {
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

const route: AssessmentRoute = { mode: 'standard', constraints: [], reasons: [] }
const payload: GuestAssessmentPayload = {
  schemaVersion: 1,
  createdAt: '2026-07-03T08:00:00.000Z',
  consentVersion: '2026-07-02',
  lastCompletedStep: 3,
  intake,
  route,
  capture: null,
}

function memoryStorage(): GuestAssessmentStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

describe('guest assessment state', () => {
  it('round-trips a valid versioned payload', () => {
    assert.deepEqual(
      decodeGuestAssessment(encodeGuestAssessment(payload), new Date('2026-07-04T07:59:59.000Z')),
      payload,
    )
  })

  it('rejects expired, future, malformed, and wrong-version payloads', () => {
    assert.equal(
      decodeGuestAssessment(encodeGuestAssessment(payload), new Date('2026-07-04T08:00:01.000Z')),
      null,
    )
    assert.equal(
      decodeGuestAssessment(encodeGuestAssessment(payload), new Date('2026-07-03T07:59:59.000Z')),
      null,
    )
    assert.equal(decodeGuestAssessment('{bad json'), null)
    assert.equal(decodeGuestAssessment(JSON.stringify({ ...payload, schemaVersion: 2 })), null)
  })

  it('uses only the namespaced session storage key and clears after persistence', () => {
    const storage = memoryStorage()

    writeGuestAssessment(storage, payload)
    assert.equal(storage.values.size, 1)
    assert.ok(storage.values.has(GUEST_ASSESSMENT_KEY))
    assert.deepEqual(readGuestAssessment(storage, new Date('2026-07-03T09:00:00.000Z')), payload)

    clearGuestAssessment(storage)
    assert.equal(readGuestAssessment(storage), null)
  })
})
