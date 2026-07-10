import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('sign-out route contract', () => {
  const source = readFileSync('app/auth/signout/route.ts', 'utf8')

  it('redirects a successful POST to a same-origin GET without deployment URL configuration', () => {
    assert.match(source, /POST\(request:\s*NextRequest\)/)
    assert.match(source, /new URL\('\/'\s*,\s*request\.nextUrl\.origin\)/)
    assert.match(source, /status:\s*303/)
    assert.doesNotMatch(source, /appEnv\.appUrl/)
  })

  it('clears the cached gate cookie from every sign-out response', () => {
    assert.match(source, /cookies\.delete\(['"]forma_gate['"]\)/)
  })

  it('handles a Supabase sign-out error instead of throwing or redirecting as success', () => {
    assert.match(source, /const\s*\{\s*error\s*\}\s*=\s*await supabase\.auth\.signOut\(\)/)
    assert.match(source, /if\s*\(error\)/)
    assert.match(source, /status:\s*503/)
  })
})
