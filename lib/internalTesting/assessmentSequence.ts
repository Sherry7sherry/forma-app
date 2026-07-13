import { ASSESSMENT_TEST_MOVEMENTS } from '@/lib/internalTesting/movementRegistry'
import { serializeTestScenario } from '@/lib/internalTesting/scenarios'

export function nextAssessmentScenario(movementId: string): string | null {
  const index = ASSESSMENT_TEST_MOVEMENTS.findIndex(item => item.id === movementId)
  const next = index >= 0 ? ASSESSMENT_TEST_MOVEMENTS[index + 1] : undefined
  if (!next) return null
  return serializeTestScenario({
    movementId: next.id,
    phase: 'setup',
    scenarioId: next.scenarios[0].id,
    repeats: 1,
  }).toString()
}
