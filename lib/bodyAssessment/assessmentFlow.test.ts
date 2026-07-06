import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('body assessment route contracts', () => {
  const page = readFileSync('app/assessment/page.tsx', 'utf8')
  const flow = readFileSync('app/assessment/BodyAssessmentFlow.tsx', 'utf8')
  const guestFlow = readFileSync('app/body-assessment/GuestAssessmentFlow.tsx', 'utf8')
  const capturePath = 'components/assessment/MovementAssessmentCapture.tsx'

  it('authenticates and selects baseline versus reassessment from unified Body Mirror evidence', () => {
    assert.match(page, /redirect\('\/login'\)/)
    assert.match(page, /loadBodyMirrorForUser/)
    assert.match(page, /selectAssessmentKind/)
    assert.match(page, /BodyAssessmentFlow/)
  })

  it('contains the approved full assessment state machine and all three movements', () => {
    const capture = readFileSync(capturePath, 'utf8')
    for (const state of ['intro', 'check_in', 'capture', 'fallback', 'result']) {
      assert.match(flow, new RegExp(`'${state}'`))
    }
    for (const movement of ['side_arm_raise', 'standing_roll_down', 'seated_trunk_rotation']) {
      assert.match(capture, new RegExp(movement))
    }
  })

  it('saves safety, partial, camera-unavailable, low-confidence, and completed evidence explicitly', () => {
    const capture = readFileSync(capturePath, 'utf8')
    assert.match(flow, /buildBodyCheckInInsert/)
    assert.match(flow, /buildAssessmentInsert/)
    assert.match(flow, /buildObservationInserts/)
    assert.match(capture, /deriveMovementObservations/)
    assert.match(flow, /outcome:\s*'partial'/)
    assert.match(flow, /outcome:\s*'camera_unavailable'/)
    assert.match(flow, /outcome:\s*'low_confidence'/)
    assert.match(flow, /outcome:\s*'completed'/)
    assert.match(flow, /safety_hold/)
  })

  it('offers camera retry and self-report fallback without creating numeric fallback observations', () => {
    const capture = readFileSync(capturePath, 'utf8')
    assert.match(capture, /Retry camera/)
    assert.match(flow, /Continue with self-report/)
    assert.match(capture, /CameraLifecycleStatus/)
    assert.match(capture, /cameraStatus === 'unavailable'/)
    assert.match(flow, /from\('body_check_ins'\)[\s\S]*notes/)
  })

  it('keeps shared capture free of persistence and exposes every outcome callback', () => {
    const capture = readFileSync(capturePath, 'utf8')
    const poseCamera = readFileSync('components/camera/PoseCamera.tsx', 'utf8')

    assert.match(capture, /interface MovementAssessmentCaptureProps/)
    for (const callback of ['onComplete', 'onLowConfidence', 'onCameraUnavailable', 'onExit']) {
      assert.match(capture, new RegExp(callback))
    }
    assert.match(capture, /constraints: MovementConstraint\[\]/)
    assert.match(capture, /PoseCamera/)
    assert.match(capture, /recoveryMode="external"/)
    assert.match(poseCamera, /recoveryMode === 'internal'/)
    assert.doesNotMatch(capture, /createClient|supabase|movement_observations|movement_assessments/i)
  })

  it('applies route constraints and never mounts capture for a guest stop route', () => {
    const capture = readFileSync(capturePath, 'utf8')

    assert.match(capture, /skip_movement/)
    assert.match(capture, /reduce_range/)
    assert.match(capture, /optional_single_arm_compare/)
    assert.match(guestFlow, /route\.mode !== 'stop'[\s\S]*MovementAssessmentCapture/)
  })
})
