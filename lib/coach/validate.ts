import type { CoachCueKey } from './cues'
import type { SessionSummary, SessionSummaryInput } from './types'

const allowedCueKeys = new Set<CoachCueKey>([
  'calibrate',
  'exerciseStart',
  'transition',
  'finish',
  'frameBody',
  'slowDown',
  'coreReset',
])

const tones = new Set(['celebrate', 'steady', 'gentle'])
const forbiddenTerms = [
  'diagnos',
  'injury',
  'treatment',
  'medication',
  'prescribe',
  '疼痛缓解',
  '诊断',
  '治疗',
  '处方',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function compactCharCount(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length
}

function hanCount(text: string): number {
  return Array.from(text).filter(char => /\p{Script=Han}/u.test(char)).length
}

function asciiLetterCount(text: string): number {
  return (text.match(/[a-z]/gi) ?? []).length
}

function containsForbiddenContent(text: string): boolean {
  const lower = text.toLowerCase()
  return forbiddenTerms.some(term => lower.includes(term))
    || /\d+\s*(min|minutes|分钟|reps|次)\b/i.test(text)
}

export function validateSummary(input: SessionSummaryInput, value: unknown): SessionSummary | null {
  if (!isObject(value)) return null

  const headline = value.headline
  const body = value.body
  const nextFocusCueKey = value.nextFocusCueKey
  const tone = value.tone

  if (typeof headline !== 'string' || !headline.trim()) return null
  if (typeof body !== 'string' || !body.trim()) return null
  if (typeof nextFocusCueKey !== 'string' || !allowedCueKeys.has(nextFocusCueKey as CoachCueKey)) return null
  if (typeof tone !== 'string' || !tones.has(tone)) return null

  const combined = `${headline}\n${body}`
  if (containsForbiddenContent(combined)) return null

  if (input.locale === 'zh-CN') {
    if (hanCount(combined) === 0) return null
    if (compactCharCount(headline) > 18 || compactCharCount(body) > 72) return null
  } else {
    if (hanCount(combined) > asciiLetterCount(combined)) return null
    if (wordCount(headline) > 12 || wordCount(body) > 48) return null
  }

  return {
    locale: input.locale,
    headline: headline.trim(),
    body: body.trim(),
    nextFocusCueKey: nextFocusCueKey as CoachCueKey,
    tone: tone as SessionSummary['tone'],
  }
}
