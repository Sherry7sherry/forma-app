import type { Locale } from '../i18n'
import type { CoachCueKey } from './cues'

export type FormBand = 'building' | 'steady' | 'strong'

export interface SessionSummaryInput {
  locale: Locale
  durationMinutes: number
  exercisesCompleted: number
  skippedExercises: number
  formBand: FormBand
}

export interface SessionSummary {
  locale: Locale
  headline: string
  body: string
  nextFocusCueKey: CoachCueKey
  tone: 'celebrate' | 'steady' | 'gentle'
}
