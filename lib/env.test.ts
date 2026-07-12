import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseInternalTesterEmails, readRequiredEnv } from './env'

describe('readRequiredEnv', () => {
  it('returns configured values', () => {
    const env = { NEXT_PUBLIC_APP_URL: 'https://forma.example' }

    assert.equal(readRequiredEnv(env, 'NEXT_PUBLIC_APP_URL'), 'https://forma.example')
  })

  it('throws a clear error for missing values', () => {
    assert.throws(
      () => readRequiredEnv({}, 'SUPABASE_SERVICE_ROLE_KEY'),
      /Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY/
    )
  })

  it('treats blank values as missing', () => {
    assert.throws(
      () => readRequiredEnv({ STRIPE_SECRET_KEY: '   ' }, 'STRIPE_SECRET_KEY'),
      /Missing required environment variable: STRIPE_SECRET_KEY/
    )
  })
})

describe('internal tester environment', () => {
  it('parses a normalized case-insensitive allowlist', () => {
    assert.deepEqual(parseInternalTesterEmails(' Alice@Example.com, bob@example.com,ALICE@example.com '), [
      'alice@example.com', 'bob@example.com',
    ])
  })

  it('ignores whitespace and empty values', () => {
    assert.deepEqual(parseInternalTesterEmails(' ,  ,'), [])
    assert.deepEqual(parseInternalTesterEmails(undefined), [])
  })
})
