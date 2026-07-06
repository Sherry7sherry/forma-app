import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveReportUpdate, type LivingReportInput } from './deriveReportUpdate.js'

const now = new Date('2026-07-06T12:00:00.000Z')
const base: LivingReportInput = {
  latestReport: {
    generatedAt: '2026-06-20T12:00:00.000Z',
    focusAreas: ['shoulders'],
  },
  checkIns: [],
  sessionEffects: [],
  reassessments: [],
  now,
}

describe('deriveReportUpdate', () => {
  it('lets one fresh daily check-in change only today intensity', () => {
    assert.deepEqual(deriveReportUpdate({
      ...base,
      checkIns: [{
        id: 'check-1',
        context: 'daily',
        comfort: 2,
        focusAreas: ['neck'],
        safetySignals: [],
        recordedAt: '2026-07-06T10:00:00.000Z',
      }],
    }), {
      kind: 'today_only',
      intensity: 'gentle',
      reason: 'Your latest check-in favors a gentler session today.',
    })
  })

  it('regresses the affected focus after two consecutive worse responses', () => {
    const decision = deriveReportUpdate({
      ...base,
      sessionEffects: [
        { id: 'effect-1', recordedAt: '2026-07-05T12:00:00.000Z', response: 'worse', focusAreas: ['shoulders'] },
        { id: 'effect-2', recordedAt: '2026-07-06T09:00:00.000Z', response: 'worse', focusAreas: ['neck', 'shoulders'] },
      ],
    })
    assert.deepEqual(decision, {
      kind: 'regress_plan',
      affectedFocusAreas: ['neck', 'shoulders'],
      reason: 'Your last two session check-ins were worse, so the next plan should reduce or substitute those movements.',
    })
  })

  it('creates a new version from a reliable fresh reassessment', () => {
    assert.deepEqual(deriveReportUpdate({
      ...base,
      reassessments: [{
        id: 'assessment-1',
        kind: 'reassessment',
        captureMode: 'camera',
        status: 'completed',
        overallConfidence: 0.7,
        completedAt: '2026-07-05T12:00:00.000Z',
      }],
    }), {
      kind: 'new_report_version',
      basis: 'reassessment',
      reason: 'A reliable, current reassessment can update your report.',
    })
  })

  it('does not create a claim from sparse or stale evidence', () => {
    assert.deepEqual(deriveReportUpdate(base), {
      kind: 'none',
      reason: 'There is not enough new evidence to update your report yet.',
    })
    assert.equal(deriveReportUpdate({
      ...base,
      reassessments: [{
        id: 'assessment-old',
        kind: 'reassessment',
        captureMode: 'camera',
        status: 'completed',
        overallConfidence: 0.95,
        completedAt: '2026-05-20T12:00:00.000Z',
      }],
    }).kind, 'none')
  })

  it('creates a four-week review only when enough recent evidence exists', () => {
    const decision = deriveReportUpdate({
      ...base,
      latestReport: { generatedAt: '2026-06-01T12:00:00.000Z', focusAreas: ['shoulders'] },
      checkIns: [
        { id: 'c1', context: 'daily', comfort: 3, focusAreas: [], safetySignals: [], recordedAt: '2026-06-20T12:00:00.000Z' },
        { id: 'c2', context: 'daily', comfort: 4, focusAreas: [], safetySignals: [], recordedAt: '2026-06-28T12:00:00.000Z' },
      ],
      sessionEffects: [
        { id: 's1', recordedAt: '2026-06-24T12:00:00.000Z', response: 'better', focusAreas: ['shoulders'] },
        { id: 's2', recordedAt: '2026-07-03T12:00:00.000Z', response: 'unchanged', focusAreas: ['shoulders'] },
      ],
    })
    assert.equal(decision.kind, 'new_report_version')
    if (decision.kind === 'new_report_version') assert.equal(decision.basis, 'four_week_review')
  })

  it('applies only the newest check-in safety semantics before every other rule', () => {
    const decision = deriveReportUpdate({
      ...base,
      checkIns: [{
        id: 'check-stop',
        context: 'daily',
        comfort: 2,
        focusAreas: ['back'],
        safetySignals: ['radiating_pain'],
        recordedAt: '2026-07-06T11:00:00.000Z',
      }],
      reassessments: [{
        id: 'assessment-1', kind: 'reassessment', captureMode: 'camera', status: 'completed',
        overallConfidence: 0.95, completedAt: '2026-07-06T10:00:00.000Z',
      }],
    })
    assert.deepEqual(decision, { kind: 'safety_hold', signals: ['radiating_pain'] })
  })
})
