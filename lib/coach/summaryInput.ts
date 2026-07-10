import type { Locale } from '../i18n'
import type { FormBand, SessionSummaryInput } from './types'

function formBandFromScore(formScore: number): FormBand {
  if (formScore >= 85) return 'strong'
  if (formScore >= 70) return 'steady'
  return 'building'
}

export function buildSummaryInput({
  locale,
  formScore,
  durationSeconds,
  exercisesCompleted,
  skippedExercises,
}: {
  locale: Locale
  formScore: number
  durationSeconds: number
  exercisesCompleted: number
  skippedExercises: number
}): SessionSummaryInput {
  return {
    locale,
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    exercisesCompleted: Math.max(0, Math.round(exercisesCompleted)),
    skippedExercises: Math.max(0, Math.round(skippedExercises)),
    formBand: formBandFromScore(formScore),
  }
}
