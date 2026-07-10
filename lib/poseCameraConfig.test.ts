import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('PoseCamera tablet front-camera stability', () => {
  const source = readFileSync('components/camera/PoseCamera.tsx', 'utf8')

  it('keeps tablet training on the front camera instead of defaulting users to rear camera', () => {
    assert.match(source, /const initialFacing:\s*'user' \| 'environment'\s*=\s*'user'/)
    assert.doesNotMatch(source, /Try the rear camera for a wider field of view/)
  })

  it('uses lighter tablet camera and pose settings for iPad Safari reliability', () => {
    assert.match(source, /isTablet\s*\?\s*\{\s*facingMode:\s*\{\s*ideal:\s*face\s*\},\s*width:\s*\{\s*ideal:\s*960\s*\},\s*height:\s*\{\s*ideal:\s*720\s*\}/)
    assert.match(source, /modelComplexity:\s*isMobile \|\| isTablet \?\s*0\s*:\s*1/)
    assert.match(source, /minDetectionConfidence:\s*isMobile \|\| isTablet \?\s*0\.5\s*:\s*0\.6/)
    assert.match(source, /minTrackingConfidence:\s*isMobile \|\| isTablet \?\s*0\.5\s*:\s*0\.6/)
    assert.match(source, /lastPoseAgeMs/)
    assert.match(source, /last pose/)
  })

  it('normalizes mobile and tablet pose input through a fixed-size canvas', () => {
    assert.match(source, /DETECTION_INPUT_WIDTH\s*=\s*640/)
    assert.match(source, /DETECTION_INPUT_HEIGHT\s*=\s*480/)
    assert.match(source, /getDetectionImage/)
    assert.match(source, /isMobile \|\| isTablet/)
    assert.match(source, /poseRef\.current\.send\(\{\s*image:\s*getDetectionImage\(videoRef\.current\)/)
    assert.match(source, /inputKind/)
  })

  it('exposes optional camera lifecycle status without changing existing callers', () => {
    assert.match(source, /onCameraStatus\?:\s*\(status:\s*CameraLifecycleStatus\)/)
    assert.match(source, /onCameraStatusRef/)
    assert.match(source, /emitCameraStatus\('loading'\)/)
    assert.match(source, /emitCameraStatus\('ready'\)/)
    assert.match(source, /emitCameraStatus\('unavailable'\)/)
  })

  it('shows camera switching only when more than one video input exists', () => {
    assert.match(source, /enumerateDevices\(\)/)
    assert.match(source, /device\.kind === 'videoinput'/)
    assert.match(source, /cameraCount > 1/)
    assert.doesNotMatch(source, /flip between the front and rear camera/i)
  })

  it('gives desktop users actionable downward-angle and placement guidance', () => {
    assert.match(source, /Tilt the screen or camera downward/i)
    assert.match(source, /hip height/i)
    assert.match(source, /2[–-]3 m/i)
  })
})

describe('Movement assessment capture readiness', () => {
  const source = readFileSync('components/assessment/MovementAssessmentCapture.tsx', 'utf8')

  it('calibrates on stable full-body frames before collecting movement samples', () => {
    assert.match(source, /calibrat/i)
    assert.match(source, /framingStatus === 'full-body'/)
    assert.match(source, /evaluateMovementEvidence/)
  })

  it('does not enable Finish from eight arbitrary samples', () => {
    assert.doesNotMatch(source, /disabled=\{sampleCount < 8/)
    assert.match(source, /disabled=\{!evidence\.ready/)
    assert.match(source, /validSampleCount/)
  })
})

describe('Assessment failure copy', () => {
  const memberSource = readFileSync('app/assessment/BodyAssessmentFlow.tsx', 'utf8')
  const guestSource = readFileSync('app/body-assessment/GuestAssessmentFlow.tsx', 'utf8')

  it('maps each low-confidence reason to actionable retry guidance', () => {
    for (const source of [memberSource, guestSource]) {
      assert.match(source, /insufficient_samples/)
      assert.match(source, /landmarks/)
      assert.match(source, /range/)
    }
  })
})
