import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertSupabaseSuccess } from './supabaseErrors'

describe('assertSupabaseSuccess', () => {
  it('does nothing when the Supabase result has no error', () => {
    assert.doesNotThrow(() => assertSupabaseSuccess({ error: null }, 'save onboarding'))
  })

  it('throws a contextual error when Supabase returns an error', () => {
    assert.throws(
      () => assertSupabaseSuccess({ error: { message: 'RLS denied write' } }, 'save onboarding'),
      /save onboarding failed: RLS denied write/
    )
  })
})
