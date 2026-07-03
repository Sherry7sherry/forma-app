import type {
  CoachingDecision,
  CoachingInput,
  CoachingInsight,
  RuleTrace,
} from './types'

const RELIABLE_CONFIDENCE = 0.70

function canonicalRegion(value: string): string {
  if (value.includes('shoulder')) return 'shoulders'
  if (value.includes('back')) return 'low back'
  if (value.includes('knee')) return 'knees'
  if (value.includes('hip')) return 'hips'
  return value
}

export function evaluateCoaching(input: CoachingInput): CoachingDecision {
  const trace: RuleTrace[] = []

  if (input.route.mode === 'stop' || input.bodyMirror.safety.shouldPause) {
    trace.push({ ruleId: 'SAFETY_STOP', priority: 1000, evidenceIds: [], effect: 'stop' })
    return {
      engineVersion: '1.0.0',
      safety: 'stop',
      insights: [],
      plan: {
        intensity: 'gentle',
        durationMinutes: input.intake.availableMinutes,
        focusAreas: [],
        preferredExerciseIds: [],
        excludedExerciseIds: input.exercises.map(exercise => exercise.id),
        regressions: {},
      },
      trace,
    }
  }

  const activeInjuryRegions = input.intake.injuryStatus === 'recovering'
    ? input.intake.injuryRegions.map(canonicalRegion)
    : []
  const excluded = new Set(input.exercises
    .filter(exercise => exercise.painSensitiveRegions
      .map(canonicalRegion)
      .some(region => activeInjuryRegions.includes(region)))
    .map(exercise => exercise.id))

  for (const exerciseId of excluded) {
    trace.push({
      ruleId: 'ACTIVE_INJURY_EXCLUDE',
      priority: 800,
      evidenceIds: [exerciseId],
      effect: 'exclude',
    })
  }

  const torsoDrift = input.observations.find(observation =>
    observation.metricKey === 'torso_drift_ratio'
    && observation.confidence >= RELIABLE_CONFIDENCE
    && observation.value >= 0.12)
  const insights: CoachingInsight[] = torsoDrift ? [{
    id: 'insight-arm-raise-torso-drift',
    claimKey: 'arm_raise_torso_drift',
    evidenceIds: [torsoDrift.id],
    confidence: torsoDrift.confidence,
    focusArea: 'trunk_control',
    allowedClaim: 'More torso lean was observed during arm raising.',
  }] : []

  if (torsoDrift) {
    trace.push({
      ruleId: 'ARM_RAISE_TORSO_DRIFT',
      priority: 400,
      evidenceIds: [torsoDrift.id],
      effect: 'insight',
    })
  }

  const focusAreas = [...new Set([
    ...input.intake.goals,
    ...insights.map(insight => insight.focusArea),
  ])]
  const preferred = input.exercises
    .filter(exercise => !excluded.has(exercise.id))
    .filter(exercise => exercise.focusAreas.some(area => focusAreas.includes(area)))
    .sort((a, b) => Number(a.difficulty !== 'gentle') - Number(b.difficulty !== 'gentle'))
    .map(exercise => exercise.id)

  for (const exerciseId of preferred) {
    trace.push({
      ruleId: 'FOCUS_AREA_PREFER',
      priority: 200,
      evidenceIds: [exerciseId],
      effect: 'prefer',
    })
  }

  return {
    engineVersion: '1.0.0',
    safety: input.route.mode === 'modified' ? 'modify' : 'allow',
    insights,
    plan: {
      intensity: input.route.mode === 'modified' ? 'gentle' : 'standard',
      durationMinutes: input.intake.availableMinutes,
      focusAreas,
      preferredExerciseIds: preferred,
      excludedExerciseIds: [...excluded],
      regressions: {},
    },
    trace,
  }
}
