import {
  GUEST_ASSESSMENT_TTL_MS,
  screenAssessment,
  type AssessmentRoute,
  type GuestAssessmentPayload,
} from '../assessmentIntake/index'
import type { DerivedObservation } from '../bodyAssessment/types'
import type { BodyMirrorResult, DimensionState } from '../bodyMirror/types'
import { evaluateCoaching, type CoachingDecision } from '../coachingPolicy/index'
import { composeAssessmentReport } from './composeReport'
import type { AssessmentReport } from './types'

const RELIABLE_CONFIDENCE = 0.70

export interface TransferRecord {
  assessmentId: string
  reportId: string
}

export interface GuestAssessmentPersistence {
  findTransfer(transferId: string, userId: string): Promise<TransferRecord | null>
  ensureAssessment(input: {
    transferId: string
    userId: string
    payload: GuestAssessmentPayload
    route: AssessmentRoute
  }): Promise<string>
  ensureObservations(input: {
    transferId: string
    assessmentId: string
    userId: string
    observations: DerivedObservation[]
    observedAt: string
  }): Promise<string[]>
  ensureIntakeVersion(input: {
    transferId: string
    assessmentId: string
    userId: string
    payload: GuestAssessmentPayload
    route: AssessmentRoute
  }): Promise<string>
  ensureReport(input: {
    transferId: string
    assessmentId: string
    intakeVersionId: string
    userId: string
    report: AssessmentReport
    evidenceRefs: string[]
  }): Promise<string>
  completeTransfer(input: TransferRecord & { transferId: string; userId: string }): Promise<void>
}

function dimension(key: 'comfort' | 'mobility' | 'control', state: DimensionState) {
  return { key, state, label: key, summary: '', detail: '', evidenceCount: 0, asOf: null }
}

export function bodyMirrorForGuestAssessment(): BodyMirrorResult {
  return {
    resultId: 'guest-transfer',
    status: 'current',
    confidenceNotice: 'none',
    freshness: { level: 'fresh', asOf: null, label: 'Current' },
    checkInAsOf: null,
    dimensions: {
      comfort: dimension('comfort', 'no_data'),
      mobility: dimension('mobility', 'baseline'),
      control: dimension('control', 'baseline'),
    },
    recommendation: {
      mode: 'quick',
      intensity: 'gentle',
      title: '',
      reason: '',
      durationMinutes: 5,
      durationSeconds: null,
      adjustedForWorseFeeling: false,
    },
    safety: { shouldPause: false, signals: [] },
    activity: { completedSessions: 0, completedMinutes: 0, currentStreak: 0, partialAttempts: 0 },
  }
}

function coachingForTransfer(
  payload: GuestAssessmentPayload,
  route: AssessmentRoute,
  observations: DerivedObservation[],
  evidenceIds: string[],
): CoachingDecision {
  return evaluateCoaching({
    intake: payload.intake,
    route,
    bodyMirror: bodyMirrorForGuestAssessment(),
    observations: observations.map((observation, index) => ({
      id: evidenceIds[index],
      metricKey: observation.metricKey,
      value: observation.value,
      confidence: observation.confidence,
    })),
    exercises: [{
      id: 'gentle-trunk-control',
      focusAreas: ['trunk_control', ...payload.intake.goals],
      painSensitiveRegions: [],
      difficulty: 'gentle',
    }],
  })
}

function validateTransfer(input: {
  userId: string
  transferId: string
  payload: GuestAssessmentPayload
  now: Date
}) {
  if (!input.userId.trim() || !input.transferId.trim()) {
    throw new Error('Authenticated user and transfer ID are required.')
  }
  const createdAt = new Date(input.payload.createdAt).getTime()
  const age = input.now.getTime() - createdAt
  if (!Number.isFinite(createdAt) || age < 0 || age > GUEST_ASSESSMENT_TTL_MS) {
    throw new Error('Guest assessment has expired.')
  }

  const route = screenAssessment(input.payload.intake)
  if (input.payload.route.mode === 'stop' || route.mode === 'stop') {
    throw new Error('A safety-stop assessment cannot transfer numeric observations.')
  }
  if (input.payload.capture?.status !== 'completed'
    || input.payload.capture.overallConfidence < RELIABLE_CONFIDENCE) {
    throw new Error('Reliable completed camera evidence is required.')
  }
  const observations = input.payload.capture.observations.filter(item =>
    item.confidence >= RELIABLE_CONFIDENCE)
  if (observations.length === 0) {
    throw new Error('No reliable movement observations are available.')
  }
  return { route, observations, capture: input.payload.capture }
}

export async function saveGuestAssessment(
  input: {
    userId: string
    transferId: string
    payload: GuestAssessmentPayload
    now?: Date
  },
  adapter: GuestAssessmentPersistence,
): Promise<TransferRecord> {
  const { route, observations, capture } = validateTransfer({
    ...input,
    now: input.now ?? new Date(),
  })
  const existing = await adapter.findTransfer(input.transferId, input.userId)
  if (existing) return existing

  const assessmentId = await adapter.ensureAssessment({
    transferId: input.transferId,
    userId: input.userId,
    payload: input.payload,
    route,
  })
  const evidenceRefs = await adapter.ensureObservations({
    transferId: input.transferId,
    assessmentId,
    userId: input.userId,
    observations,
    observedAt: capture.completedAt,
  })
  if (evidenceRefs.length !== observations.length) {
    throw new Error('Persisted observation evidence is incomplete.')
  }
  const intakeVersionId = await adapter.ensureIntakeVersion({
    transferId: input.transferId,
    assessmentId,
    userId: input.userId,
    payload: input.payload,
    route,
  })
  const coaching = coachingForTransfer(input.payload, route, observations, evidenceRefs)
  const report = composeAssessmentReport({
    intake: input.payload.intake,
    route,
    coaching,
    freshness: 'fresh',
    assessment: {
      captureMode: 'camera',
      status: 'completed',
      overallConfidence: capture.overallConfidence,
      completedAt: capture.completedAt,
    },
  })
  const reportId = await adapter.ensureReport({
    transferId: input.transferId,
    assessmentId,
    intakeVersionId,
    userId: input.userId,
    report,
    evidenceRefs,
  })
  const record = { assessmentId, reportId }
  await adapter.completeTransfer({
    transferId: input.transferId,
    userId: input.userId,
    ...record,
  })
  return record
}
