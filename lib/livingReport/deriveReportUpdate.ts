import {
  BODY_MIRROR_CONFIDENCE_THRESHOLD,
  CHECK_IN_FRESH_HOURS,
  MOVEMENT_STALE_DAYS,
  type BodyCheckInEvidence,
  type MovementAssessmentEvidence,
  type PostSessionResponse,
  type SafetySignal,
} from '../bodyMirror/types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const FOUR_WEEK_DAYS = 28
const MINIMUM_REVIEW_EVIDENCE = 4

export interface LivingReportSnapshot {
  generatedAt: string
  focusAreas: string[]
}

export interface SessionEffectEvidence {
  id: string
  recordedAt: string
  response: PostSessionResponse
  focusAreas: string[]
}

export interface LivingReportInput {
  latestReport: LivingReportSnapshot | null
  checkIns: BodyCheckInEvidence[]
  sessionEffects: SessionEffectEvidence[]
  reassessments: MovementAssessmentEvidence[]
  now: Date
}

export type ReportUpdateDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'today_only'; intensity: 'gentle' | 'standard'; reason: string }
  | { kind: 'regress_plan'; affectedFocusAreas: string[]; reason: string }
  | { kind: 'new_report_version'; basis: 'reassessment' | 'four_week_review'; reason: string }
  | { kind: 'safety_hold'; signals: SafetySignal[] }

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function newest<T>(items: T[], dateOf: (item: T) => string | null): T | undefined {
  return [...items].sort((left, right) => timestamp(dateOf(right)) - timestamp(dateOf(left)))[0]
}

function ageInDays(value: string, now: Date): number {
  return Math.max(0, (now.getTime() - timestamp(value)) / DAY_MS)
}

function isNewerThanReport(value: string, report: LivingReportSnapshot | null): boolean {
  return !report || timestamp(value) > timestamp(report.generatedAt)
}

function reliableCurrentReassessment(input: LivingReportInput): MovementAssessmentEvidence | undefined {
  return newest(input.reassessments.filter(assessment =>
    assessment.kind === 'reassessment'
    && assessment.status === 'completed'
    && assessment.completedAt !== null
    && (assessment.overallConfidence ?? 0) >= BODY_MIRROR_CONFIDENCE_THRESHOLD
    && ageInDays(assessment.completedAt, input.now) <= MOVEMENT_STALE_DAYS
    && isNewerThanReport(assessment.completedAt, input.latestReport)
  ), assessment => assessment.completedAt)
}

function fourWeekReviewIsDue(input: LivingReportInput): boolean {
  if (!input.latestReport || ageInDays(input.latestReport.generatedAt, input.now) < FOUR_WEEK_DAYS) return false
  const windowStart = input.now.getTime() - FOUR_WEEK_DAYS * DAY_MS
  const checkInCount = input.checkIns.filter(item => timestamp(item.recordedAt) >= windowStart).length
  const sessionEffectCount = input.sessionEffects.filter(item => timestamp(item.recordedAt) >= windowStart).length
  return checkInCount + sessionEffectCount >= MINIMUM_REVIEW_EVIDENCE
}

export function deriveReportUpdate(input: LivingReportInput): ReportUpdateDecision {
  const latestCheckIn = newest(input.checkIns, item => item.recordedAt)
  if (latestCheckIn && latestCheckIn.safetySignals.length > 0) {
    return { kind: 'safety_hold', signals: latestCheckIn.safetySignals }
  }

  if (reliableCurrentReassessment(input)) {
    return {
      kind: 'new_report_version',
      basis: 'reassessment',
      reason: 'A reliable, current reassessment can update your report.',
    }
  }

  const latestEffects = [...input.sessionEffects]
    .sort((left, right) => timestamp(right.recordedAt) - timestamp(left.recordedAt))
    .slice(0, 2)
  if (latestEffects.length === 2 && latestEffects.every(effect => effect.response === 'worse')) {
    const affectedFocusAreas = [...new Set(
      latestEffects.flatMap(effect => effect.focusAreas.length > 0
        ? effect.focusAreas
        : input.latestReport?.focusAreas ?? []),
    )]
    return {
      kind: 'regress_plan',
      affectedFocusAreas,
      reason: 'Your last two session check-ins were worse, so the next plan should reduce or substitute those movements.',
    }
  }

  if (fourWeekReviewIsDue(input)) {
    return {
      kind: 'new_report_version',
      basis: 'four_week_review',
      reason: 'Four weeks of new evidence are ready for a report review.',
    }
  }

  if (latestCheckIn
    && latestCheckIn.context === 'daily'
    && (input.now.getTime() - timestamp(latestCheckIn.recordedAt)) / HOUR_MS <= CHECK_IN_FRESH_HOURS
    && isNewerThanReport(latestCheckIn.recordedAt, input.latestReport)) {
    const gentle = latestCheckIn.comfort <= 2
    return {
      kind: 'today_only',
      intensity: gentle ? 'gentle' : 'standard',
      reason: gentle
        ? 'Your latest check-in favors a gentler session today.'
        : 'Your latest check-in supports the standard session today.',
    }
  }

  return {
    kind: 'none',
    reason: 'There is not enough new evidence to update your report yet.',
  }
}
