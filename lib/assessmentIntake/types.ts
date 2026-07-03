export const ASSESSMENT_INTAKE_VERSION = 1 as const

export type IntakeSafetySignal =
  | 'sharp_pain'
  | 'numbness'
  | 'radiating_pain'
  | 'dizziness'
  | 'professional_pause'

export interface AssessmentIntake {
  version: typeof ASSESSMENT_INTAKE_VERSION
  goals: string[]
  focusRegions: string[]
  sensation: 'none' | 'tight' | 'achy' | 'painful' | 'numb_or_radiating'
  injuryStatus: 'none' | 'recovered' | 'occasional' | 'recovering'
  injuryRegions: string[]
  movementFrequency: 'rarely' | 'weekly_1' | 'weekly_2_3' | 'weekly_4_plus'
  workPattern: 'sitting_under_4h' | 'sitting_4_8h' | 'sitting_over_8h' | 'mostly_moving'
  availableMinutes: 5 | 15 | 30
  safetySignals: IntakeSafetySignal[]
}

export interface PolicyReason {
  ruleId: string
  evidencePaths: string[]
  userMessage: string
}

export type AssessmentMovement =
  | 'side_arm_raise'
  | 'standing_roll_down'
  | 'seated_trunk_rotation'

export type MovementConstraint =
  | { kind: 'reduce_range'; movement: AssessmentMovement }
  | { kind: 'skip_movement'; movement: AssessmentMovement }
  | { kind: 'optional_single_arm_compare'; movement: 'side_arm_raise' }

export type AssessmentRoute =
  | { mode: 'standard'; constraints: []; reasons: PolicyReason[] }
  | { mode: 'modified'; constraints: MovementConstraint[]; reasons: PolicyReason[] }
  | { mode: 'stop'; constraints: []; reasons: PolicyReason[] }
