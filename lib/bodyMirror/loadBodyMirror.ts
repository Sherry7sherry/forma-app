import { deriveBodyMirror } from './deriveBodyMirror'
import type {
  BodyCheckInEvidence,
  BodyMirrorEvidence,
  BodyMirrorResult,
  DeriveBodyMirrorOptions,
  MovementAssessmentEvidence,
  MovementObservationEvidence,
  SafetySignal,
  SessionBodyFeeling,
  SessionEvidence,
} from './types'

interface QueryResult {
  data: unknown[] | null
  error: { message: string } | null
}

interface BodyMirrorQuery {
  select(columns?: string): BodyMirrorQuery
  eq(column: string, value: string): BodyMirrorQuery
  order(column: string, options?: { ascending?: boolean }): BodyMirrorQuery
  limit(count: number): BodyMirrorQuery
}

export interface BodyMirrorDataClient {
  from(table: string): unknown
}

export interface LoadBodyMirrorResult {
  result: BodyMirrorResult | null
  error: string | null
}

type DatabaseRow = Record<string, unknown>

function rows(value: unknown[] | null): DatabaseRow[] {
  return (value ?? []).filter(item => item !== null && typeof item === 'object') as DatabaseRow[]
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

function mapCheckIn(row: DatabaseRow): BodyCheckInEvidence {
  return {
    id: stringValue(row.id),
    context: stringValue(row.context) as BodyCheckInEvidence['context'],
    comfort: numberValue(row.comfort),
    focusAreas: stringArray(row.focus_areas),
    safetySignals: stringArray(row.safety_signals) as SafetySignal[],
    recordedAt: stringValue(row.recorded_at),
  }
}

function mapAssessment(row: DatabaseRow): MovementAssessmentEvidence {
  return {
    id: stringValue(row.id),
    kind: stringValue(row.kind) as MovementAssessmentEvidence['kind'],
    captureMode: stringValue(row.capture_mode) as MovementAssessmentEvidence['captureMode'],
    status: stringValue(row.status) as MovementAssessmentEvidence['status'],
    overallConfidence: row.overall_confidence === null ? null : numberValue(row.overall_confidence),
    completedAt: optionalString(row.completed_at),
  }
}

function mapObservation(row: DatabaseRow): MovementObservationEvidence {
  return {
    id: stringValue(row.id),
    assessmentId: stringValue(row.assessment_id),
    movementKey: stringValue(row.movement_key) as MovementObservationEvidence['movementKey'],
    dimension: stringValue(row.dimension) as MovementObservationEvidence['dimension'],
    side: stringValue(row.side) as MovementObservationEvidence['side'],
    metricKey: stringValue(row.metric_key),
    value: numberValue(row.value),
    unit: stringValue(row.unit),
    betterDirection: stringValue(row.better_direction) as MovementObservationEvidence['betterDirection'],
    changeThreshold: numberValue(row.change_threshold),
    confidence: numberValue(row.confidence),
    observedAt: stringValue(row.observed_at),
  }
}

function mapSession(row: DatabaseRow): SessionEvidence {
  return {
    id: stringValue(row.id),
    completedAt: optionalString(row.completed_at),
    durationSeconds: numberValue(row.duration_seconds),
    isPartial: Boolean(row.is_partial),
    bodyFeelBefore: optionalString(row.body_feel_before) as SessionBodyFeeling | null,
    bodyFeelAfter: optionalString(row.body_feel_after) as SessionBodyFeeling | null,
  }
}

export async function loadBodyMirrorForUser(
  supabase: BodyMirrorDataClient,
  userId: string,
  options: DeriveBodyMirrorOptions = {},
): Promise<LoadBodyMirrorResult> {
  const query = (table: string) => supabase.from(table) as BodyMirrorQuery
  const run = (builder: BodyMirrorQuery) => Promise.resolve(
    builder as unknown as PromiseLike<QueryResult>,
  )
  const [checkIns, assessments, observations, sessions] = await Promise.all([
    run(query('body_check_ins')
      .select('id, context, comfort, focus_areas, safety_signals, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(100)),
    run(query('movement_assessments')
      .select('id, kind, capture_mode, status, overall_confidence, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(100)),
    run(query('movement_observations')
      .select('id, assessment_id, movement_key, dimension, side, metric_key, value, unit, better_direction, change_threshold, confidence, observed_at')
      .eq('user_id', userId)
      .order('observed_at', { ascending: false })
      .limit(500)),
    run(query('session_records')
      .select('id, completed_at, duration_seconds, is_partial, body_feel_before, body_feel_after')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(200)),
  ])

  if (checkIns.error || assessments.error || observations.error || sessions.error) {
    return { result: null, error: 'Body Mirror data is temporarily unavailable.' }
  }

  const evidence: BodyMirrorEvidence = {
    checkIns: rows(checkIns.data).map(mapCheckIn),
    assessments: rows(assessments.data).map(mapAssessment),
    observations: rows(observations.data).map(mapObservation),
    sessions: rows(sessions.data).map(mapSession),
  }

  return { result: deriveBodyMirror(evidence, options), error: null }
}
