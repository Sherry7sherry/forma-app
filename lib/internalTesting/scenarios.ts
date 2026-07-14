import { getTestableMovement } from './movementRegistry'

export const TEST_SCENARIO_PHASES = ['full-run', 'setup', 'capture', 'calibrating', 'exercising'] as const
export type TestScenarioPhase = typeof TEST_SCENARIO_PHASES[number]

export interface TestScenario {
  movementId: string
  phase: TestScenarioPhase
  scenarioId: string
  repeats: number
}

export function serializeTestScenario(value: TestScenario) {
  const params = new URLSearchParams({
    v: '1',
    movement: value.movementId,
    phase: value.phase,
    scenario: value.scenarioId,
    repeats: String(value.repeats),
  })
  return params
}

export function parseTestScenario(params: URLSearchParams): TestScenario {
  if (params.get('v') !== '1') throw new TypeError('unsupported scenario version')

  const movementId = params.get('movement') ?? ''
  const movement = getTestableMovement(movementId)
  if (!movement) throw new TypeError('invalid movement')

  const phase = params.get('phase') ?? ''
  if (!TEST_SCENARIO_PHASES.includes(phase as TestScenarioPhase)) throw new TypeError('invalid phase')

  const scenarioId = params.get('scenario') ?? ''
  if (!movement.scenarios.some(item => item.id === scenarioId)) throw new TypeError('incompatible scenario')

  const repeats = Number(params.get('repeats'))
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new TypeError('invalid repeat count')

  return { movementId, phase: phase as TestScenarioPhase, scenarioId, repeats }
}
