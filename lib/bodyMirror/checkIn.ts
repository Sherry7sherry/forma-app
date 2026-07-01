import type { BodyCheckInContext, SafetySignal } from './types'

const SAFETY_SIGNALS = new Set<string>([
  'sharp_pain',
  'numbness',
  'radiating_pain',
  'dizziness',
  'chest_pain',
  'shortness_of_breath',
  'sudden_weakness',
])

export interface BodyCheckInInput {
  userId: string
  context?: BodyCheckInContext
  comfort: number
  focusAreas: string[]
  safetySignals: string[]
  recordedAt?: string
}

export interface BodyCheckInInsert {
  user_id: string
  context: BodyCheckInContext
  comfort: number
  focus_areas: string[]
  safety_signals: SafetySignal[]
  recorded_at: string
}

export function buildBodyCheckInInsert(input: BodyCheckInInput): BodyCheckInInsert {
  if (!Number.isInteger(input.comfort) || input.comfort < 1 || input.comfort > 5) {
    throw new Error('Comfort must be an integer from 1 to 5.')
  }
  const unknownSignal = input.safetySignals.find(signal => !SAFETY_SIGNALS.has(signal))
  if (unknownSignal) throw new Error(`Unknown safety signal: ${unknownSignal}`)

  return {
    user_id: input.userId,
    context: input.context ?? 'daily',
    comfort: input.comfort,
    focus_areas: [...new Set(input.focusAreas)],
    safety_signals: [...new Set(input.safetySignals)] as SafetySignal[],
    recorded_at: input.recordedAt ?? new Date().toISOString(),
  }
}
