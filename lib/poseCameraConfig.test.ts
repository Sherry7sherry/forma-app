import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  createDetectionGeometry,
  detectionLandmarkToSource,
  sourceLandmarkToDetection,
} from './poseDetectionGeometry.js'

describe('pose detection geometry', () => {
  it('keeps portrait and landscape sources in their native aspect without letterboxing', () => {
    const portrait = createDetectionGeometry(480, 640)
    assert.deepEqual(
      { width: portrait.detectionWidth, height: portrait.detectionHeight },
      { width: 480, height: 640 },
    )
    assert.equal(portrait.paddingX, 0)
    assert.equal(portrait.paddingY, 0)
    assert.equal(portrait.orientation, 'portrait')

    const landscape = createDetectionGeometry(1280, 720)
    assert.deepEqual(
      { width: landscape.detectionWidth, height: landscape.detectionHeight },
      { width: 640, height: 360 },
    )
    assert.ok(landscape.detectionWidth * landscape.detectionHeight <= 640 * 480)
  })

  it('round-trips source and detection landmarks in either orientation', () => {
    for (const geometry of [
      createDetectionGeometry(1080, 1920),
      createDetectionGeometry(1920, 1080),
    ]) {
      const source = { x: 0.27, y: 0.83, z: -0.12, visibility: 0.91 }
      const roundTrip = detectionLandmarkToSource(
        sourceLandmarkToDetection(source, geometry),
        geometry,
      )
      assert.ok(Math.abs(roundTrip.x - source.x) < 0.000001)
      assert.ok(Math.abs(roundTrip.y - source.y) < 0.000001)
      assert.equal(roundTrip.z, source.z)
      assert.equal(roundTrip.visibility, source.visibility)
    }
  })
})

describe('PoseCamera tablet front-camera stability', () => {
  const source = readFileSync('components/camera/PoseCamera.tsx', 'utf8')

  it('keeps tablet training on the front camera instead of defaulting users to rear camera', () => {
    assert.match(source, /const initialFacing:\s*'user' \| 'environment'\s*=\s*'user'/)
    assert.doesNotMatch(source, /Try the rear camera for a wider field of view/)
  })

  it('uses lighter default pose settings while allowing assessment precision after geometry is fixed', () => {
    assert.match(source, /isTablet\s*\?\s*\{\s*facingMode:\s*\{\s*ideal:\s*face\s*\},\s*width:\s*\{\s*ideal:\s*960\s*\},\s*height:\s*\{\s*ideal:\s*720\s*\}/)
    assert.match(source, /assessmentPrecision\s*\?\s*1/)
    assert.match(source, /modelComplexity/)
    assert.match(source, /minDetectionConfidence:\s*isMobile \|\| isTablet \?\s*0\.5\s*:\s*0\.6/)
    assert.match(source, /minTrackingConfidence:\s*isMobile \|\| isTablet \?\s*0\.5\s*:\s*0\.6/)
    assert.match(source, /lastPoseAgeMs/)
    assert.match(source, /last pose/)
  })

  it('normalizes mobile and tablet pose input through an orientation-aware canvas', () => {
    assert.match(source, /createDetectionGeometry/)
    assert.match(source, /canvas\.width\s*=\s*geometry\.detectionWidth/)
    assert.match(source, /canvas\.height\s*=\s*geometry\.detectionHeight/)
    assert.match(source, /getDetectionImage/)
    assert.match(source, /isMobile \|\| isTablet/)
    assert.match(source, /poseRef\.current\.send\(\{\s*image:\s*getDetectionImage\(videoRef\.current\)/)
    assert.match(source, /inputKind/)
    assert.match(source, /detectionLandmarkToSource/)
    assert.match(source, /detectionWidth/)
    assert.match(source, /paddingX/)
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

  it('branches setup copy by device and never gives a phone laptop instructions', () => {
    assert.match(source, /deviceClass === 'phone'/)
    assert.match(source, /Lower or tilt your phone downward/i)
    assert.match(source, /On a laptop/i)
  })

  it('keeps the foot area visible by moving the compact calibration prompt away from the bottom', () => {
    assert.match(source, /absolute top-16/)
    assert.doesNotMatch(source, /calibrated\s*\?\s*'[^']*bottom-4/)
    assert.doesNotMatch(source, /inset-x-4 bottom-4 rounded-3xl/)
  })

  it('collects a neutral roll-down baseline and explains each readiness blocker', () => {
    assert.match(source, /baselineReady/)
    assert.match(source, /phase:\s*'baseline'/)
    assert.match(source, /baseline_missing/)
    assert.match(source, /Stand tall and hold still/i)
    assert.match(source, /Keep one wrist and ankle visible/i)
  })

  it('resets every capture accumulator when movement one advances to movement two', () => {
    assert.match(source, /function resetCaptureState/)
    for (const reset of [
      /samplesRef\.current\s*=\s*\[\]/,
      /lastSampleAtRef\.current\s*=\s*0/,
      /stableFullBodyFramesRef\.current\s*=\s*0/,
      /setCalibrated\(false\)/,
      /setBaselineReady\(false\)/,
      /setEvidence\(EMPTY_EVIDENCE\)/,
    ]) assert.match(source, reset)
    assert.match(source, /setMovementIndex[\s\S]*resetCaptureState\(\)[\s\S]*setStage\('setup'\)/)
  })

  it('uses seated-torso calibration for movement three instead of requiring feet', () => {
    assert.match(source, /framingRequirement=\{movement\.key === 'seated_trunk_rotation'\s*\?\s*'seated-torso'/)
    assert.match(source, /Seated framing ready/)
    assert.match(source, /Keep both shoulders and hips clear/i)
    assert.match(source, /Complete a gentle turn to both sides/i)
  })

  it('moves the compact prompt to the blank side of the tracked torso', () => {
    assert.match(source, /guidanceSide/)
    assert.match(source, /guidanceSide === 'left'\s*\?\s*'left-3'/)
    assert.doesNotMatch(source, /inset-x-4 bottom-4/)
  })

  it('keeps desktop capture inside one viewport and gives remaining height to the camera', () => {
    assert.match(source, /stage === 'capture' \? 'h-dvh overflow-hidden/)
    assert.match(source, /stage === 'capture' \? 'px-3 pb-2 pt-2 sm:px-5 sm:py-2'/)
    assert.match(source, /relative min-h-0 flex-1 overflow-hidden/)
    assert.doesNotMatch(source, /relative min-h-\[58dvh\] flex-1 overflow-hidden/)
    assert.match(source, /sm:py-2/)
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
      assert.match(source, /baseline_missing/)
    }
  })
})
