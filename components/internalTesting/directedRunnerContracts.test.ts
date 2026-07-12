import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('directed runner controls', () => {
  for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
    it(`${name} persists report and force-continue actions`, () => {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')
      assert.match(source, /useDirectedAttempt/)
      assert.match(source, /onRecord=\{recordIssue\}/)
      assert.match(source, /onForceContinue=\{forceContinue\}/)
      assert.doesNotMatch(source, /onRecord=\{\(\)=>\{\}\}/)
      assert.doesNotMatch(source, /onForceContinue=\{\(\)=>\{\}\}/)
    })
  }
})
