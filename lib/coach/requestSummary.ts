import type { SessionSummary } from './types'

export type SessionSummaryResponse = {
  summary: SessionSummary
  status: 'generated' | 'fallback' | 'unavailable'
}

function isSummary(value: unknown): value is SessionSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const summary = value as Partial<SessionSummary>
  return (summary.locale === 'en-US' || summary.locale === 'zh-CN')
    && typeof summary.headline === 'string'
    && typeof summary.body === 'string'
    && typeof summary.nextFocusCueKey === 'string'
    && (summary.tone === 'celebrate' || summary.tone === 'steady' || summary.tone === 'gentle')
}

export function parseSummaryResponse(value: unknown): SessionSummaryResponse | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const response = value as { summary?: unknown; status?: unknown }
  if (!isSummary(response.summary)) return null
  if (response.status !== 'generated' && response.status !== 'fallback' && response.status !== 'unavailable') return null
  return {
    summary: response.summary,
    status: response.status,
  }
}

export async function requestSessionSummary(sessionRecordId: string): Promise<SessionSummaryResponse | null> {
  const response = await fetch('/api/coach/session-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionRecordId }),
  })
  if (!response.ok) return null
  return parseSummaryResponse(await response.json())
}
