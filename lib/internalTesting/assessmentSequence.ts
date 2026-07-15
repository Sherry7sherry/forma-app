import { ASSESSMENT_TEST_MOVEMENTS, EXERCISE_TEST_MOVEMENTS } from '@/lib/internalTesting/movementRegistry'
import { serializeTestScenario } from '@/lib/internalTesting/scenarios'

export function nextAssessmentScenario(movementId: string): string | null {
  const index = ASSESSMENT_TEST_MOVEMENTS.findIndex(item => item.id === movementId)
  const next = index >= 0 ? ASSESSMENT_TEST_MOVEMENTS[index + 1] : undefined
  if (!next) return null
  return serializeTestScenario({
    movementId: next.id,
    phase: 'full-run',
    scenarioId: next.scenarios[0].id,
    repeats: 1,
  }).toString()
}

export function nextExerciseScenario(movementId: string, repeats = 1): string | null {
  const index = EXERCISE_TEST_MOVEMENTS.findIndex(item => item.id === movementId)
  const next = index >= 0 ? EXERCISE_TEST_MOVEMENTS[index + 1] : undefined
  if (!next) return null
  return serializeTestScenario({
    movementId: next.id,
    phase: 'full-run',
    scenarioId: next.scenarios[0].id,
    repeats,
  }).toString()
}
