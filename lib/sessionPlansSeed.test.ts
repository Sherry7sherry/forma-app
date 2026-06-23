import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('session plan seed names', () => {
  it('uses a non-series name for the postnatal foundation plan', () => {
    const fullSetup = readFileSync('supabase/migrations/000_full_setup.sql', 'utf8')
    const exerciseSeed = readFileSync('supabase/migrations/002_seed_exercises.sql', 'utf8')

    assert.match(fullSetup, /Postnatal Foundation/)
    assert.match(exerciseSeed, /Postnatal Foundation/)
    assert.doesNotMatch(fullSetup, /Postnatal Recovery — Week 1/)
    assert.doesNotMatch(exerciseSeed, /Postnatal Recovery — Week 1/)
  })
})
