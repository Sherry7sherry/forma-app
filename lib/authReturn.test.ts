import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { safeNext } from './authReturn.js'

describe('safeNext', () => {
  it('allows an internal absolute path', () => {
    assert.equal(safeNext('/body-assessment/save'), '/body-assessment/save')
    assert.equal(safeNext('/onboarding?plan=pro'), '/onboarding?plan=pro')
  })

  it('rejects external, protocol-relative, malformed, and missing destinations', () => {
    for (const value of [
      null,
      '',
      'https://attacker.example',
      '//attacker.example',
      '/\\attacker.example',
      '/%5c%5cattacker.example',
      '/auth\n/callback',
    ]) {
      assert.equal(safeNext(value), '/onboarding')
    }
  })
})
