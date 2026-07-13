import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('directed runner controls', () => {
  it('keeps the standing assessment separate from the supine Arm Arcs training profile', () => {
    const registry = readFileSync('lib/internalTesting/movementRegistry.ts', 'utf8')
    assert.match(registry, /id: 'assessment:side_arm_raise',[\s\S]*?exerciseName: 'Standing arm raise'/)
    assert.doesNotMatch(registry, /id: 'assessment:side_arm_raise',[\s\S]*?exerciseName: 'Arm Arcs'/)
  })

  it('gives every record action an immediate, visible success or failure state', () => {
    const overlay = readFileSync('components/internalTesting/InternalTestOverlay.tsx', 'utf8')
    assert.match(overlay, /Saving internal test evidence/)
    assert.match(overlay, /Problem recorded/)
    assert.match(overlay, /Could not record/)
    assert.match(overlay, /aria-live="polite"/)
  })

  it('advances a directed assessment after a successful synthetic continuation', () => {
    const source = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    assert.match(source, /useRouter/)
    assert.match(source, /nextAssessmentScenario/)
    assert.match(source, /router\.push/)
    assert.match(source, /await forceContinue\(\)/)
  })

  for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
    it(`${name} persists report and force-continue actions`, () => {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')
      assert.match(source, /useDirectedAttempt/)
      assert.match(source, /onRecord=\{recordIssue\}/)
      assert.match(source, name === 'DirectedAssessmentRunner.tsx'
        ? /onForceContinue=\{continueToNextMovement\}/
        : /onForceContinue=\{forceContinue\}/)
      assert.doesNotMatch(source, /onRecord=\{\(\)=>\{\}\}/)
      assert.doesNotMatch(source, /onForceContinue=\{\(\)=>\{\}\}/)
    })
  }
})
