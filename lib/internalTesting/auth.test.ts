import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { authorizeInternalIdentity, internalApiAuthorization } from './auth.js'

describe('internal tester authorization', () => {
  const allowlist = ['tester@example.com']

  it('authorizes only authenticated allowlisted email identities', () => {
    assert.deepEqual(authorizeInternalIdentity({ id: 'u1', email: 'Tester@Example.com' }, allowlist), {
      userId: 'u1', email: 'tester@example.com',
    })
    assert.equal(authorizeInternalIdentity(null, allowlist), null)
    assert.equal(authorizeInternalIdentity({ id: 'u2', email: 'normal@example.com' }, allowlist), null)
  })

  it('returns distinct API authentication and authorization failures', () => {
    assert.deepEqual(internalApiAuthorization(null, allowlist), { ok: false, status: 401, code: 'unauthenticated' })
    assert.deepEqual(internalApiAuthorization({ id: 'u2', email: 'normal@example.com' }, allowlist), { ok: false, status: 403, code: 'internal_tester_required' })
    assert.equal(internalApiAuthorization({ id: 'u1', email: 'tester@example.com' }, allowlist).ok, true)
  })

  it('never treats query parameters as authorization', () => {
    const requestUrl = new URL('https://forma.test/internal/test-lab?testMode=1&email=tester@example.com')
    assert.equal(requestUrl.searchParams.get('testMode'), '1')
    assert.equal(authorizeInternalIdentity(null, allowlist), null)
  })
})
