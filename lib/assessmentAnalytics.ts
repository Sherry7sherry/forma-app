export const ASSESSMENT_FUNNEL_EVENTS = [
  'assessment_entry',
  'consent',
  'intake_complete',
  'camera_start',
  'assessment_complete',
  'first_insight',
  'registration_redirect',
  'report_preview',
  'first_session',
  'trial_start',
  'reassessment_complete',
  'monthly_report_view',
] as const

export type AssessmentFunnelEventName = (typeof ASSESSMENT_FUNNEL_EVENTS)[number]

const ALLOWED_VALUES = {
  step_name: new Set([
    'entry', 'consent', 'intake', 'safety_screen', 'camera_assessment', 'first_insight',
    'registration', 'report', 'first_session', 'trial', 'reassessment', 'monthly_report',
  ]),
  outcome: new Set([
    'started', 'accepted', 'completed', 'stopped', 'low_confidence', 'camera_unavailable',
    'redirected', 'viewed', 'success', 'cancelled', 'failed',
  ]),
  failure_category: new Set([
    'camera_denied', 'low_confidence', 'save_failed', 'incomplete', 'safety_stop',
  ]),
  duration_bucket: new Set([
    'under_one_minute', 'one_to_three_minutes', 'three_to_five_minutes', 'over_five_minutes',
  ]),
  confidence_bucket: new Set(['none', 'low', 'medium', 'high']),
  experiment_variant: new Set(['control', 'choice_first_v1', 'living_report_v1']),
} as const

export type AssessmentAnalyticsProperties = Partial<Record<keyof typeof ALLOWED_VALUES, string>>

export interface SanitizedAssessmentEvent {
  name: AssessmentFunnelEventName
  properties: AssessmentAnalyticsProperties
}

export function sanitizeAssessmentEvent(
  name: AssessmentFunnelEventName,
  properties: Record<string, unknown>,
): SanitizedAssessmentEvent | null {
  if (!(ASSESSMENT_FUNNEL_EVENTS as readonly string[]).includes(name)) return null
  const sanitized: AssessmentAnalyticsProperties = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!(key in ALLOWED_VALUES) || typeof value !== 'string') return null
    const allowed = ALLOWED_VALUES[key as keyof typeof ALLOWED_VALUES] as ReadonlySet<string>
    if (!allowed.has(value)) return null
    sanitized[key as keyof AssessmentAnalyticsProperties] = value
  }
  return { name, properties: sanitized }
}

export function trackAssessmentEvent(
  name: AssessmentFunnelEventName,
  properties: Record<string, unknown> = {},
): SanitizedAssessmentEvent | null {
  const event = sanitizeAssessmentEvent(name, properties)
  if (!event || typeof window === 'undefined') return event
  window.dispatchEvent(new CustomEvent('forma:assessment-analytics', { detail: event }))
  return event
}
