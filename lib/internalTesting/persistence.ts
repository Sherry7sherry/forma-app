import { getTestableMovement } from '@/lib/internalTesting/movementRegistry'
import type { JsonValue } from '@/lib/internalTesting/trackingEvents'

export const INTERNAL_ISSUE_TYPES = [
  'unable-to-continue', 'missed-repetitions', 'extra-repetitions', 'incorrect-feedback',
  'missing-feedback', 'camera-framing', 'display', 'performance', 'other',
] as const
export type InternalIssueType = typeof INTERNAL_ISSUE_TYPES[number]
export type AttemptStatus = 'active' | 'passed' | 'failed' | 'blocked' | 'retried' | 'skipped' | 'pending-upload'

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
  return value as Record<string, unknown>
}
function text(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`)
  return value.trim()
}

export function validateRun(input: unknown) {
  const value = object(input, 'run')
  if (!['assessment', 'session', 'directed'].includes(String(value.sourceFlow))) throw new TypeError('invalid source flow')
  return {
    sourceFlow: value.sourceFlow as 'assessment' | 'session' | 'directed',
    buildVersion: text(value.buildVersion, 'buildVersion'),
    profileVersion: text(value.profileVersion, 'profileVersion'),
    environment: object(value.environment, 'environment') as Record<string, JsonValue>,
  }
}

export function validateAttempt(input: unknown) {
  const value = object(input, 'attempt')
  const movementId = text(value.movementId, 'movementId')
  const movement = getTestableMovement(movementId)
  if (!movement) throw new TypeError('invalid movement ID')
  return { runId: text(value.runId, 'runId'), movementId, phase: text(value.phase, 'phase'), movement }
}

export function validateEventBatch(input: unknown) {
  const value = object(input, 'event batch')
  if (!Number.isInteger(value.sequence) || Number(value.sequence) < 0) throw new TypeError('invalid sequence')
  if (!Array.isArray(value.events)) throw new TypeError('events must be an array')
  return { attemptId: text(value.attemptId, 'attemptId'), sequence: Number(value.sequence), events: value.events as JsonValue[] }
}

export function validateArtifact(input: unknown) {
  const value = object(input, 'artifact')
  if (!['diagnostic-json', 'diagnostic-compressed', 'screen-recording-reference'].includes(String(value.kind))) throw new TypeError('invalid artifact kind')
  if (!['pending', 'uploaded', 'failed', 'exported'].includes(String(value.uploadState))) throw new TypeError('invalid upload state')
  return { attemptId: text(value.attemptId, 'attemptId'), kind: String(value.kind), uploadState: String(value.uploadState) }
}

export function validateCompletion(input: unknown) {
  const value = object(input, 'completion')
  if (!['passed', 'failed', 'blocked', 'retried', 'skipped', 'pending-upload'].includes(String(value.status))) throw new TypeError('invalid status')
  if (value.issueType !== undefined && !INTERNAL_ISSUE_TYPES.includes(value.issueType as InternalIssueType)) throw new TypeError('invalid issue type')
  if (value.actualCount !== undefined && (!Number.isInteger(value.actualCount) || Number(value.actualCount) < 0)) throw new TypeError('invalid actual count')
  if (value.synthetic && Object.keys(value).some(key => /^production|observation|sessionRecord/i.test(key))) throw new TypeError('synthetic evidence cannot reference production data')
  return { status: value.status as AttemptStatus, issueType: value.issueType as InternalIssueType | undefined, actualCount: value.actualCount as number | undefined, synthetic: value.synthetic === true }
}
