import type { AssessmentIntake, AssessmentRoute } from '../assessmentIntake/types'
import type { MovementAssessmentEvidence, BodyMirrorFreshness } from '../bodyMirror/types'
import type { CoachingDecision, CoachingInsight } from '../coachingPolicy/types'

export type AssessmentReportClaimKey = CoachingInsight['claimKey']

export const ASSESSMENT_REPORT_CLAIM_KEYS = [
  'arm_raise_torso_drift',
  'controlled_forward_bend',
  'rotation_difference',
] as const satisfies readonly AssessmentReportClaimKey[]

export interface AssessmentReportSection {
  id: string
  kind: 'body_story' | 'insight' | 'safety' | 'training_direction' | 'training_path' | 'reassessment'
  visibility: 'free' | 'paid'
  title: string
  body: string
  claimKey?: AssessmentReportClaimKey
  evidenceIds: string[]
  confidence: number | null
}

export interface AssessmentReport {
  schemaVersion: 1
  engineVersion: string
  status: 'ready' | 'insufficient_evidence' | 'safety_hold'
  generatedAt: string
  assessmentAsOf: string | null
  sections: AssessmentReportSection[]
  triggeredRuleIds: string[]
}

export interface ComposeAssessmentReportInput {
  intake: AssessmentIntake
  route: AssessmentRoute
  coaching: CoachingDecision
  freshness: BodyMirrorFreshness['level']
  assessment: Pick<
    MovementAssessmentEvidence,
    'captureMode' | 'status' | 'overallConfidence' | 'completedAt'
  >
  generatedAt?: string
}
