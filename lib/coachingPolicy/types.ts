import type { AssessmentIntake, AssessmentRoute } from '../assessmentIntake/types'
import type { BodyMirrorResult } from '../bodyMirror/types'

export interface CoachingInsight {
  id: string
  claimKey: 'arm_raise_torso_drift' | 'controlled_forward_bend' | 'rotation_difference'
  evidenceIds: string[]
  confidence: number
  focusArea: 'shoulder_mobility' | 'trunk_control' | 'spine_mobility'
  allowedClaim: string
}

export interface RuleTrace {
  ruleId: string
  priority: number
  evidenceIds: string[]
  effect: 'stop' | 'exclude' | 'regress' | 'prefer' | 'insight'
}

export interface CoachingDecision {
  engineVersion: '1.0.0'
  safety: 'allow' | 'modify' | 'stop'
  insights: CoachingInsight[]
  plan: {
    intensity: 'gentle' | 'standard'
    durationMinutes: 5 | 15 | 30
    focusAreas: string[]
    preferredExerciseIds: string[]
    excludedExerciseIds: string[]
    regressions: Record<string, string>
  }
  trace: RuleTrace[]
}

export interface CoachingObservation {
  id: string
  metricKey: string
  value: number
  confidence: number
}

export interface ExerciseProfile {
  id: string
  focusAreas: string[]
  painSensitiveRegions: string[]
  difficulty: 'gentle' | 'beginner' | 'intermediate' | 'advanced'
}

export interface CoachingInput {
  intake: AssessmentIntake
  route: AssessmentRoute
  bodyMirror: BodyMirrorResult
  observations: CoachingObservation[]
  exercises: ExerciseProfile[]
}
