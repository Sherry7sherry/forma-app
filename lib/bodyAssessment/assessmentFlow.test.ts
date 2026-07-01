import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('body assessment route contracts', () => {
  const page = readFileSync('app/assessment/page.tsx', 'utf8')
  const flow = readFileSync('app/assessment/BodyAssessmentFlow.tsx', 'utf8')

  it('authenticates and selects baseline versus reassessment from unified Body Mirror evidence', () => {
    assert.match(page, /redirect\('\/login'\)/)
    assert.match(page, /loadBodyMirrorForUser/)
    assert.match(page, /selectAssessmentKind/)
    assert.match(page, /BodyAssessmentFlow/)
  })

  it('contains the approved full assessment state machine and all three movements', () => {
    for (const state of ['intro', 'check_in', 'setup', 'capture', 'fallback', 'result']) {
      assert.match(flow, new RegExp(`'${state}'`))
    }
    for (const movement of ['side_arm_raise', 'standing_roll_down', 'seated_trunk_rotation']) {
      assert.match(flow, new RegExp(movement))
    }
  })

  it('saves safety, partial, camera-unavailable, low-confidence, and completed evidence explicitly', () => {
    assert.match(flow, /buildBodyCheckInInsert/)
    assert.match(flow, /buildAssessmentInsert/)
    assert.match(flow, /buildObservationInserts/)
    assert.match(flow, /deriveMovementObservations/)
    assert.match(flow, /outcome:\s*'partial'/)
    assert.match(flow, /outcome:\s*'camera_unavailable'/)
    assert.match(flow, /outcome:\s*'low_confidence'/)
    assert.match(flow, /outcome:\s*'completed'/)
    assert.match(flow, /safety_hold/)
  })

  it('offers camera retry and self-report fallback without creating numeric fallback observations', () => {
    assert.match(flow, /Retry camera/)
    assert.match(flow, /Continue with self-report/)
    assert.match(flow, /CameraLifecycleStatus/)
    assert.match(flow, /cameraStatus === 'unavailable'/)
    assert.match(flow, /from\('body_check_ins'\)[\s\S]*notes/)
  })
})
