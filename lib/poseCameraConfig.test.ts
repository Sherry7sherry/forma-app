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
})
