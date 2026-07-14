import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseTestScenario, serializeTestScenario, type TestScenario } from './scenarios.js'

describe('internal test scenario', () => {
  it('defaults new lab links to a full run instead of asking testers to guess the failure phase', () => {
    const scenario = { movementId: 'exercise:glute-bridge', phase: 'full-run', scenarioId: 'automatic-count', repeats: 3 } satisfies TestScenario
    const params = serializeTestScenario(scenario)

    assert.equal(params.get('phase'), 'full-run')
    assert.deepEqual(parseTestScenario(params), scenario)
  })

  it('round-trips a stable versioned scenario URL', () => {
    const scenario = { movementId: 'exercise:glute-bridge', phase: 'calibrating', scenarioId: 'automatic-count', repeats: 3 } satisfies TestScenario
    const params = serializeTestScenario(scenario)
    assert.deepEqual(parseTestScenario(params), scenario)
  })
  it('rejects unknown movement, invalid phase/repeat count, and incompatible scenarios', () => {
    assert.throws(() => parseTestScenario(new URLSearchParams('v=1&movement=missing&phase=x&scenario=x&repeats=1')))
    assert.throws(() => parseTestScenario(new URLSearchParams('v=1&movement=exercise:glute-bridge&phase=x&scenario=automatic-count&repeats=0')))
    assert.throws(() => parseTestScenario(new URLSearchParams('v=1&movement=exercise:pelvic-floor-activation&phase=calibrating&scenario=automatic-count&repeats=1')))
  })
})
