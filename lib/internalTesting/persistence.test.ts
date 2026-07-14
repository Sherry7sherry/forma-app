import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { validateArtifact, validateAttempt, validateCompletion, validateEventBatch, validateRun } from './persistence.js'

describe('internal test persistence', () => {
  it('validates isolated run, attempt, event, artifact, and completion payloads', () => {
    assert.equal(validateRun({ sourceFlow: 'directed', buildVersion: 'b1', profileVersion: 'p1', environment: { browser: 'Safari' } }).sourceFlow, 'directed')
    assert.equal(validateAttempt({ runId: 'r1', movementId: 'exercise:glute-bridge', phase: 'calibration' }).movementId, 'exercise:glute-bridge')
    assert.equal(validateEventBatch({ attemptId: 'a1', sequence: 0, events: [] }).sequence, 0)
    assert.equal(validateArtifact({ attemptId: 'a1', kind: 'diagnostic-json', uploadState: 'pending' }).uploadState, 'pending')
    assert.equal(validateCompletion({ status: 'passed', actualCount: 2, synthetic: false }).status, 'passed')
  })

  it('rejects invalid movement IDs, issue types, counts, and production references', () => {
    assert.throws(() => validateAttempt({ runId: 'r1', movementId: 'missing', phase: 'capture' }))
    assert.throws(() => validateCompletion({ status: 'failed', issueType: 'made-up' }))
    assert.throws(() => validateCompletion({ status: 'passed', actualCount: -1 }))
    assert.throws(() => validateCompletion({ status: 'passed', synthetic: true, productionObservationId: 'obs-1' } as never))
  })

  it('uses tester-friendly issue options while accepting legacy issue values', () => {
    const source = readFileSync('lib/internalTesting/persistence.ts', 'utf8')
    for (const label of [
      'Camera issue',
      'Calibration issue',
      'Count missed',
      'False count',
      'Tracking flicker',
      'Display issue',
      'Performance issue',
      'Other',
    ]) {
      assert.match(source, new RegExp(label))
    }
    assert.equal(validateCompletion({ status: 'failed', issueType: 'calibration-issue' }).issueType, 'calibration-issue')
    assert.equal(validateCompletion({ status: 'failed', issueType: 'unable-to-continue' }).issueType, 'unable-to-continue')
  })

  it('defines isolated tables with RLS and no production evidence foreign keys', () => {
    const sql = readFileSync('supabase/migrations/011_internal_movement_testing.sql', 'utf8')
    for (const table of ['internal_test_runs', 'internal_test_attempts', 'internal_test_events', 'internal_test_artifacts']) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    }
    assert.doesNotMatch(sql, /references public\.(movement_observations|movement_assessments|session_records)/)
    assert.doesNotMatch(sql, /create policy/)
    assert.match(sql, /unique \(attempt_id, sequence\)/)
  })
})
