import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('assessment conversion pages', () => {
  it('shows one deterministic insight before registration without commercial copy', () => {
    const page = readFileSync('app/body-assessment/insight/page.tsx', 'utf8')

    assert.match(page, /evaluateCoaching/)
    assert.match(page, /Save my body starting point and view my report/)
    assert.match(page, /\/signup\?next=/)
    assert.doesNotMatch(page, /price|trial|locked|checkout/i)
  })

  it('preserves only safe internal return paths through email and OAuth auth', () => {
    const signup = readFileSync('app/(auth)/signup/page.tsx', 'utf8')
    const callback = readFileSync('app/auth/callback/route.ts', 'utf8')

    assert.match(signup, /safeNext/)
    assert.match(signup, /searchParams\.get\('next'\)/)
    assert.match(signup, /emailRedirectTo/)
    assert.match(callback, /safeNext/)
    assert.match(callback, /searchParams\.get\('next'\)/)
  })

  it('requires auth and clears guest state only after a successful durable save', () => {
    const page = readFileSync('app/body-assessment/save/page.tsx', 'utf8')
    const client = readFileSync('app/body-assessment/save/SaveGuestAssessment.tsx', 'utf8')

    assert.match(page, /redirect\('\/signup\?next=/)
    assert.match(client, /saveGuestAssessment/)
    assert.match(client, /await saveGuestAssessment[\s\S]*clearGuestAssessment/)
    assert.match(client, /router\.replace\('\/body-report'\)/)
  })
})
