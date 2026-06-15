import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * ISO timestamp for the start of the current week (Monday 00:00, UTC).
 * Used for the free-tier session quota so the limit actually "resets Monday"
 * as the UI promises — rather than sliding on a rolling 7-day window.
 */
export function startOfWeekISO(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()            // 0 = Sun … 6 = Sat
  const diff = (day === 0 ? 6 : day - 1) // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString()
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'text-sage-dark'
  if (score >= 70) return 'text-amber-600'
  return 'text-rose-dark'
}

export function difficultyLabel(d: string): string {
  return { gentle: 'Gentle', moderate: 'Moderate', challenging: 'Challenging' }[d] ?? d
}
