import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('browser Supabase client environment access', () => {
  it('uses statically analyzable NEXT_PUBLIC env reads in the client bundle', () => {
    const source = readFileSync('lib/supabase/client.ts', 'utf8')

    assert.match(source, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/)
    assert.match(source, /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    assert.doesNotMatch(source, /appEnv/)
  })
})
