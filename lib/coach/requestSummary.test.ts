import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseSummaryResponse } from './requestSummary'

describe('session summary client request', () => {
  it('accepts only the expected server response shape', () => {
    assert.equal(parseSummaryResponse({ summary: { locale: 'en-US', headline: 'Nice work', body: 'You moved steadily today.', nextFocusCueKey: 'coreReset', tone: 'steady' }, status: 'generated' })?.status, 'generated')
    assert.equal(parseSummaryResponse({ status: 'generated' }), null)
  })

  it('requests the server recap only after session completion persistence succeeds and never blocks finish', () => {
    const source = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')
    assert.match(source, /assertSupabaseSuccess\(result, 'Complete session'\)[\s\S]*void requestSessionSummary/)
    assert.match(source, /void requestSessionSummary[\s\S]*setPhase\('finished'\)/)
    assert.doesNotMatch(source, /await requestSessionSummary/)
  })
})
