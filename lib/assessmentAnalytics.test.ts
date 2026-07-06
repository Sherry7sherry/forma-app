import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { sanitizeAssessmentEvent } from './assessmentAnalytics.js'

describe('sanitizeAssessmentEvent', () => {
  it('allows only approved funnel metadata with enumerated values', () => {
    assert.deepEqual(sanitizeAssessmentEvent('assessment_complete', {
      step_name: 'camera_assessment',
      outcome: 'completed',
      duration_bucket: 'three_to_five_minutes',
      confidence_bucket: 'high',
      experiment_variant: 'choice_first_v1',
    }), {
      name: 'assessment_complete',
      properties: {
        step_name: 'camera_assessment',
        outcome: 'completed',
        duration_bucket: 'three_to_five_minutes',
        confidence_bucket: 'high',
        experiment_variant: 'choice_first_v1',
      },
    })
  })

  it('rejects sensitive, unknown, and free-text properties', () => {
    for (const key of ['injury', 'symptom_detail', 'notes', 'landmarks', 'video_url', 'free_text']) {
      assert.equal(sanitizeAssessmentEvent('assessment_entry', { [key]: 'private value' }), null)
    }
    assert.equal(sanitizeAssessmentEvent('assessment_entry', { outcome: 'my arbitrary story' }), null)
  })

  it('rejects unapproved event names', () => {
    assert.equal(sanitizeAssessmentEvent('questionnaire_answers' as never, {}), null)
  })
})

describe('assessment funnel integration contracts', () => {
  const guestFlow = readFileSync('app/body-assessment/GuestAssessmentFlow.tsx', 'utf8')
  const insight = readFileSync('app/body-assessment/insight/page.tsx', 'utf8')
  const report = readFileSync('components/body-report/AssessmentReportView.tsx', 'utf8')
  const player = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')
  const profile = readFileSync('app/(app)/profile/page.tsx', 'utf8')
  const reportPage = readFileSync('app/(app)/body-report/page.tsx', 'utf8')
  const authenticatedAssessment = readFileSync('app/assessment/BodyAssessmentFlow.tsx', 'utf8')

  it('instruments the approved acquisition and value moments without answer values', () => {
    for (const event of ['assessment_entry', 'consent', 'intake_complete', 'camera_start', 'assessment_complete']) {
      assert.match(guestFlow, new RegExp(`trackAssessmentEvent\\('${event}'`))
    }
    assert.match(insight, /trackAssessmentEvent\('first_insight'/)
    assert.match(insight, /trackAssessmentEvent\('registration_redirect'/)
    assert.match(report, /trackAssessmentEvent\('report_preview'/)
    assert.match(player, /trackAssessmentEvent\('first_session'/)
    assert.match(player, /trackAssessmentEvent\('trial_start'/)
    assert.match(authenticatedAssessment, /trackAssessmentEvent\('reassessment_complete'/)
    assert.match(report, /trackAssessmentEvent\('monthly_report_view'/)
  })

  it('exposes report history, export, and confirmed deletion entry points', () => {
    assert.match(profile, /Body report (?:&|&amp;) history/)
    assert.match(profile, /Export my data/)
    assert.match(profile, /Delete account and data/)
    assert.match(profile, /confirmation/i)
    assert.match(profile, /\/body-report#report-history/)
    assert.match(reportPage, /body_report_versions[\s\S]*\.eq\('user_id', user\.id\)/)
    assert.match(report, /id="report-history"/)
  })

  it('keeps export user-scoped and account deletion behind typed confirmation', () => {
    const exportRoute = readFileSync('app/api/account/export/route.ts', 'utf8')
    const deleteRoute = readFileSync('app/api/account/delete/route.ts', 'utf8')
    assert.match(exportRoute, /auth\.getUser\(\)/)
    assert.match(exportRoute, /body_report_versions/)
    assert.match(exportRoute, /Content-Disposition/)
    assert.match(deleteRoute, /confirmation !== 'DELETE'/)
    assert.match(deleteRoute, /subscription_status[\s\S]*billing_active/)
    assert.match(deleteRoute, /auth\.admin\.deleteUser\(user\.id\)/)
  })
})
