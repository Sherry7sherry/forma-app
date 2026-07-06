import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { loadLatestReport, partitionReportSections } from './loadLatestReport.js'
import type { AssessmentReport } from './types.js'

const report: AssessmentReport = {
  schemaVersion: 1,
  engineVersion: '1.0.0',
  status: 'ready',
  generatedAt: '2026-07-03T08:05:00.000Z',
  assessmentAsOf: '2026-07-03T08:04:00.000Z',
  sections: [
    { id: 'story', kind: 'body_story', visibility: 'free', title: 'Story', body: 'Body', evidenceIds: [], confidence: null },
    { id: 'insight', kind: 'insight', visibility: 'free', title: 'Insight', body: 'Body', evidenceIds: ['obs-1'], confidence: 0.88 },
    { id: 'path', kind: 'training_path', visibility: 'paid', title: 'Your trunk control path', body: 'Body', evidenceIds: ['obs-1'], confidence: 0.88 },
  ],
  triggeredRuleIds: ['ARM_RAISE_TORSO_DRIFT'],
}

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<{ table: string; userId?: string; order?: string; limit?: number }> = []
  return {
    calls,
    from(table: string) {
      const call = { table } as { table: string; userId?: string; order?: string; limit?: number }
      calls.push(call)
      const query = {
        select() { return query },
        eq(_column: string, value: string) { call.userId = value; return query },
        order(column: string) { call.order = column; return query },
        limit(count: number) { call.limit = count; return query },
        maybeSingle() { return Promise.resolve(result) },
      }
      return query
    },
  }
}

describe('loadLatestReport', () => {
  it('loads only the current user latest generated report', async () => {
    const client = fakeClient({ data: { id: 'report-1', report }, error: null })
    const loaded = await loadLatestReport(client, 'user-1')

    assert.deepEqual(loaded, { reportId: 'report-1', report, error: null })
    assert.deepEqual(client.calls, [{
      table: 'body_report_versions', userId: 'user-1', order: 'generated_at', limit: 1,
    }])
  })

  it('treats missing, malformed, and query failures as recoverable', async () => {
    assert.deepEqual(await loadLatestReport(fakeClient({ data: null, error: null }), 'user-1'), {
      reportId: null, report: null, error: null,
    })
    assert.match((await loadLatestReport(fakeClient({ data: { report: { status: 'ready' } }, error: null }), 'user-1')).error ?? '', /unavailable/i)
    assert.match((await loadLatestReport(fakeClient({ data: null, error: { message: 'missing' } }), 'user-1')).error ?? '', /unavailable/i)
  })

  it('partitions free sections before paid sections without changing either order', () => {
    const partitioned = partitionReportSections(report)
    assert.deepEqual(partitioned.free.map(item => item.id), ['story', 'insight'])
    assert.deepEqual(partitioned.paid.map(item => item.id), ['path'])
  })
})

describe('body report page contracts', () => {
  const page = readFileSync('app/(app)/body-report/page.tsx', 'utf8')
  const view = readFileSync('components/body-report/AssessmentReportView.tsx', 'utf8')

  it('loads the owned report and resolves Desk Reset on the server', () => {
    assert.match(page, /loadLatestReport\(.*user\.id/s)
    assert.match(page, /\.eq\('name', 'Desk Reset'\)/)
    assert.match(page, /reportId=\{loaded\.reportId\}/)
    assert.match(view, /intro=\$\{reportId\}/)
  })

  it('renders free story before personalized paid chapters', () => {
    assert.match(view, /free\.map[\s\S]*paid\.map/)
    assert.match(view, /Try my first five-minute session/)
    assert.match(view, /Continue with free/)
  })

  it('keeps safety free and discloses confidence and evidence without a body score', () => {
    assert.match(view, /report\.status !== 'safety_hold'[\s\S]*paid\.map/)
    assert.match(view, /Confidence and evidence/)
    assert.match(view, /camera-derived movement observations/i)
    assert.doesNotMatch(`${page}\n${view}`, /body score|overall score/i)
  })
})
