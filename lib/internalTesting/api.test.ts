import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apiError, classifyDatabaseError, parseJsonRequest } from './api.js'

describe('internal test api', () => {
  it('returns stable authorization and validation error envelopes', () => {
    assert.deepEqual(apiError('unauthenticated', 401), { ok: false, error: { code: 'unauthenticated' }, status: 401 })
    assert.deepEqual(apiError('internal_tester_required', 403), { ok: false, error: { code: 'internal_tester_required' }, status: 403 })
  })
  it('classifies duplicate, missing, and server failures', () => {
    assert.equal(classifyDatabaseError({ code: '23505' }).code, 'duplicate_batch')
    assert.equal(classifyDatabaseError({ code: 'PGRST116' }).code, 'not_found')
    assert.equal(classifyDatabaseError({ code: 'XX000' }).retryable, true)
  })
  it('rejects malformed request bodies', () => {
    assert.throws(() => parseJsonRequest(null))
    assert.throws(() => parseJsonRequest([]))
    assert.deepEqual(parseJsonRequest({ movementId: 'x' }), { movementId: 'x' })
  })
})
