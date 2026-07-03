import type { AssessmentFailureReason, DerivedObservation } from '../bodyAssessment/types'
import type { AssessmentIntake, AssessmentRoute } from './types'

export const GUEST_ASSESSMENT_KEY = 'forma:guest-assessment:v1'
export const GUEST_ASSESSMENT_TTL_MS = 24 * 60 * 60 * 1000

export type GuestCaptureState =
  | {
      status: 'completed'
      observations: DerivedObservation[]
      overallConfidence: number
      completedAt: string
    }
  | {
      status: 'low_confidence'
      observations: []
      overallConfidence: number
      reason: AssessmentFailureReason
      completedAt: string
    }
  | {
      status: 'camera_unavailable'
      observations: []
      overallConfidence: null
      completedAt: string
    }

export interface GuestAssessmentPayload {
  schemaVersion: 1
  createdAt: string
  consentVersion: '2026-07-02'
  lastCompletedStep: number
  intake: AssessmentIntake
  route: AssessmentRoute
  capture: GuestCaptureState | null
}

export interface GuestAssessmentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isIntake(value: unknown): value is AssessmentIntake {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.version === 1
    && isStringArray(item.goals)
    && isStringArray(item.focusRegions)
    && ['none', 'tight', 'achy', 'painful', 'numb_or_radiating'].includes(String(item.sensation))
    && ['none', 'recovered', 'occasional', 'recovering'].includes(String(item.injuryStatus))
    && isStringArray(item.injuryRegions)
    && ['rarely', 'weekly_1', 'weekly_2_3', 'weekly_4_plus'].includes(String(item.movementFrequency))
    && ['sitting_under_4h', 'sitting_4_8h', 'sitting_over_8h', 'mostly_moving'].includes(String(item.workPattern))
    && [5, 15, 30].includes(Number(item.availableMinutes))
    && isStringArray(item.safetySignals)
}

function isRoute(value: unknown): value is AssessmentRoute {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['standard', 'modified', 'stop'].includes(String(item.mode))
    && Array.isArray(item.constraints)
    && Array.isArray(item.reasons)
}

function isCapture(value: unknown): value is GuestCaptureState | null {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (!['completed', 'low_confidence', 'camera_unavailable'].includes(String(item.status))) return false
  if (!Array.isArray(item.observations) || typeof item.completedAt !== 'string') return false
  if (item.status === 'camera_unavailable') return item.overallConfidence === null && item.observations.length === 0
  return typeof item.overallConfidence === 'number'
    && item.overallConfidence >= 0
    && item.overallConfidence <= 1
    && (item.status !== 'low_confidence' || item.observations.length === 0)
}

function isPayload(value: unknown): value is GuestAssessmentPayload {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.schemaVersion === 1
    && item.consentVersion === '2026-07-02'
    && typeof item.createdAt === 'string'
    && Number.isInteger(item.lastCompletedStep)
    && Number(item.lastCompletedStep) >= 0
    && Number(item.lastCompletedStep) <= 7
    && isIntake(item.intake)
    && isRoute(item.route)
    && isCapture(item.capture)
}

export function encodeGuestAssessment(payload: GuestAssessmentPayload): string {
  return JSON.stringify(payload)
}

export function decodeGuestAssessment(raw: string, now = new Date()): GuestAssessmentPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isPayload(parsed)) return null
    const createdAt = new Date(parsed.createdAt).getTime()
    const age = now.getTime() - createdAt
    if (!Number.isFinite(createdAt) || age < 0 || age > GUEST_ASSESSMENT_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeGuestAssessment(storage: GuestAssessmentStorage, payload: GuestAssessmentPayload) {
  storage.setItem(GUEST_ASSESSMENT_KEY, encodeGuestAssessment(payload))
}

export function readGuestAssessment(storage: GuestAssessmentStorage, now = new Date()) {
  const raw = storage.getItem(GUEST_ASSESSMENT_KEY)
  return raw ? decodeGuestAssessment(raw, now) : null
}

export function clearGuestAssessment(storage: GuestAssessmentStorage) {
  storage.removeItem(GUEST_ASSESSMENT_KEY)
}
