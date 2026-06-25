import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('session rep feedback copy', () => {
  const source = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')

  it('uses short immediate counted-rep voice copy', () => {
    assert.match(source, /text:\s*'Good\.'/)
    assert.match(source, /cooldownMs:\s*0/)
    assert.doesNotMatch(source, /Nice, rep counted/)
    assert.doesNotMatch(source, /cooldownMs:\s*26_000/)
  })

  it('uses actionable not-counted messages', () => {
    assert.match(source, /Move a little bigger/)
    assert.match(source, /Return to start/)
    assert.match(source, /Step back, I need your full body/)
    assert.match(source, /Improve lighting or slow down/)
  })

  it('renders the rep cycle stage labels', () => {
    assert.match(source, /Start/)
    assert.match(source, /Move/)
    assert.match(source, /Return/)
    assert.match(source, /Count/)
    assert.match(source, /repCycleStage/)
  })

  it('contains initial Glute Bridge and Chest Lift quality cues', () => {
    assert.match(source, /qualityCue/)
    assert.match(source, /Keep both hips level/)
    assert.match(source, /Press knees forward/)
    assert.match(source, /Lift from your glutes/)
    assert.match(source, /Keep your neck long/)
    assert.match(source, /Soften your ribs/)
    assert.match(source, /Leave space under your chin/)
  })

  it('shows a strong center-screen counted rep confirmation', () => {
    assert.match(source, /\+1/)
    assert.match(source, /rep-pulse/)
    assert.match(source, /REP_COUNTED_DISPLAY_MS\s*=\s*800/)
  })

  it('explains calibration start blockers and exposes delayed manual fallback', () => {
    assert.match(source, /START_ANYWAY_DELAY_MS\s*=\s*8_000/)
    assert.match(source, /calibBlocker/)
    assert.match(source, /Rotate your phone to/)
    assert.match(source, /No body detected/)
    assert.match(source, /Only upper body visible/)
    assert.match(source, /Confidence too low/)
    assert.match(source, /key points visible/)
    assert.match(source, /Start anyway/)
  })

  it('speaks short calibration blocker cues without reading diagnostics aloud', () => {
    assert.match(source, /voice:\s*\{\s*key:\s*'calib-upper-body'/)
    assert.match(source, /Step back until I can see your legs/)
    assert.match(source, /Lower the camera or step back/)
    assert.match(source, /You can start anyway if you want/)
    assert.doesNotMatch(source, /text:\s*`Only \$\{visibleCount\} of \$\{requiredCount\}/)
  })
})
