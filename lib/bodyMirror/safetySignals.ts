import type { SafetySignal } from './types'

const SAFETY_SIGNAL_LABELS: Record<SafetySignal, string> = {
  sharp_pain: 'sharp pain',
  numbness: 'numbness',
  radiating_pain: 'radiating pain',
  dizziness: 'dizziness',
  chest_pain: 'chest pain',
  shortness_of_breath: 'shortness of breath',
  sudden_weakness: 'sudden weakness',
  professional_pause: 'a professional recommendation to pause',
}

export function formatSafetySignals(signals: SafetySignal[]): string {
  const labels = signals.map(signal => SAFETY_SIGNAL_LABELS[signal])
  if (labels.length === 0) return 'Stop signal'

  const readable = labels.length === 1
    ? labels[0]
    : labels.length === 2
      ? `${labels[0]} and ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`

  return readable.charAt(0).toUpperCase() + readable.slice(1)
}
