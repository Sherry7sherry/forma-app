import type { AssessmentIntake, AssessmentRoute } from '../assessmentIntake/types'
import { ASSESSMENT_REPORT_CLAIM_KEYS } from './types'

const APPROVED_CLAIM_KEYS = new Set<string>(ASSESSMENT_REPORT_CLAIM_KEYS)

function assertOwned(authenticatedUserId: string, userId: string) {
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    throw new Error('Payload user must match the authenticated user.')
  }
}

export interface HealthIntakeVersionInput {
  authenticatedUserId: string
  userId: string
  assessmentId: string | null
  intake: AssessmentIntake
  route: AssessmentRoute
  consentVersion: string
  planPreferences: Record<string, unknown>
}

export function buildHealthIntakeVersionInsert(input: HealthIntakeVersionInput) {
  assertOwned(input.authenticatedUserId, input.userId)
  if (!input.consentVersion.trim()) {
    throw new Error('A save consent version is required.')
  }

  return {
    user_id: input.userId,
    assessment_id: input.assessmentId,
    intake_version: input.intake.version,
    answers: input.intake,
    safety_state: input.route.mode,
    constraints: input.route.constraints,
    plan_preferences: input.planPreferences,
    consent_version: input.consentVersion,
  }
}

interface PersistedReportSection {
  claimKey?: string
  evidenceIds?: readonly string[]
  [key: string]: unknown
}

interface PersistedReport {
  status: string
  sections: readonly PersistedReportSection[]
  [key: string]: unknown
}

export interface ReportVersionInput {
  authenticatedUserId: string
  userId: string
  assessmentId: string | null
  intakeVersionId: string | null
  reportVersion: number
  engineVersion: string
  report: PersistedReport
  evidenceRefs: readonly string[]
  changeSummary: string | null
  generatedAt?: string
}

export function buildReportVersionInsert(input: ReportVersionInput) {
  assertOwned(input.authenticatedUserId, input.userId)
  if (!Number.isInteger(input.reportVersion) || input.reportVersion < 1) {
    throw new Error('Report version must be a positive integer.')
  }
  if (input.evidenceRefs.length === 0) {
    throw new Error('A persisted report requires evidence references.')
  }

  for (const section of input.report.sections) {
    if (section.claimKey && !APPROVED_CLAIM_KEYS.has(section.claimKey)) {
      throw new Error(`Unsupported report claim key: ${section.claimKey}`)
    }
  }

  return {
    user_id: input.userId,
    assessment_id: input.assessmentId,
    intake_version_id: input.intakeVersionId,
    report_version: input.reportVersion,
    engine_version: input.engineVersion,
    report: input.report,
    evidence_refs: [...new Set(input.evidenceRefs)],
    change_summary: input.changeSummary,
    ...(input.generatedAt ? { generated_at: input.generatedAt } : {}),
  }
}
