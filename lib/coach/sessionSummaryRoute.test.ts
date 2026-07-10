import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('session summary route boundary', () => {
  it('loads an owned record server-side and never accepts a client score', () => {
    const source = readFileSync('app/api/coach/session-summary/route.ts', 'utf8')
    assert.match(source, /\.eq\('user_id', user\.id\)/)
    assert.match(source, /sessionRecordId/)
    assert.doesNotMatch(source, /formScore:\s*body/)
  })
})
