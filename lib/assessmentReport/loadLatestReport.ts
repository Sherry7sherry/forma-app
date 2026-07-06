import type { AssessmentReport, AssessmentReportSection } from './types'

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

interface LatestReportQuery {
  select(columns?: string): LatestReportQuery
  eq(column: string, value: string): LatestReportQuery
  order(column: string, options?: { ascending?: boolean }): LatestReportQuery
  limit(count: number): LatestReportQuery
  maybeSingle(): Promise<QueryResult>
}

export interface LatestReportClient {
  from(table: string): unknown
}

const REPORT_STATUSES = new Set(['ready', 'insufficient_evidence', 'safety_hold'])
const SECTION_KINDS = new Set([
  'body_story', 'insight', 'safety', 'training_direction', 'training_path', 'reassessment',
])

function isSection(value: unknown): value is AssessmentReportSection {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && SECTION_KINDS.has(String(item.kind))
    && (item.visibility === 'free' || item.visibility === 'paid')
    && typeof item.title === 'string'
    && typeof item.body === 'string'
    && Array.isArray(item.evidenceIds)
    && item.evidenceIds.every(id => typeof id === 'string')
    && (item.confidence === null
      || (typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1))
}

function isReport(value: unknown): value is AssessmentReport {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.schemaVersion === 1
    && typeof item.engineVersion === 'string'
    && REPORT_STATUSES.has(String(item.status))
    && typeof item.generatedAt === 'string'
    && (item.assessmentAsOf === null || typeof item.assessmentAsOf === 'string')
    && Array.isArray(item.sections)
    && item.sections.every(isSection)
    && Array.isArray(item.triggeredRuleIds)
    && item.triggeredRuleIds.every(rule => typeof rule === 'string')
}

export async function loadLatestReport(
  client: LatestReportClient,
  userId: string,
): Promise<{ reportId: string | null; report: AssessmentReport | null; error: string | null }> {
  const query = client.from('body_report_versions') as LatestReportQuery
  const result = await query
    .select('id, report')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) return { reportId: null, report: null, error: 'Your body report is temporarily unavailable.' }
  if (!result.data) return { reportId: null, report: null, error: null }
  const row = result.data as Record<string, unknown>
  if (typeof row.id !== 'string' || !isReport(row.report)) {
    return { reportId: null, report: null, error: 'Your body report is temporarily unavailable.' }
  }
  return { reportId: row.id, report: row.report, error: null }
}

export function partitionReportSections(report: AssessmentReport) {
  return {
    free: report.sections.filter(section => section.visibility === 'free'),
    paid: report.sections.filter(section => section.visibility === 'paid'),
  }
}
