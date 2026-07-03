import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AssessmentIntake, AssessmentRoute } from '../assessmentIntake/index.js'
import type { CoachingDecision } from '../coachingPolicy/index.js'
import { composeAssessmentReport } from './composeReport.js'
import type { ComposeAssessmentReportInput } from './types.js'

const intake: AssessmentIntake = {
  version: 1,
  goals: ['reduce_sitting_stiffness'],
  focusRegions: ['neck_shoulders'],
  sensation: 'tight',
  injuryStatus: 'none',
  injuryRegions: [],
  movementFrequency: 'rarely',
  workPattern: 'sitting_over_8h',
  availableMinutes: 5,
  safetySignals: [],
}

const standardRoute: AssessmentRoute = { mode: 'standard', constraints: [], reasons: [] }

const coaching: CoachingDecision = {
  engineVersion: '1.0.0',
  safety: 'allow',
  insights: [{
    id: 'insight-arm-raise-torso-drift',
    claimKey: 'arm_raise_torso_drift',
    evidenceIds: ['obs-1'],
    confidence: 0.88,
    focusArea: 'trunk_control',
    allowedClaim: 'More torso lean was observed during arm raising.',
  }],
  plan: {
    intensity: 'standard',
    durationMinutes: 5,
    focusAreas: ['trunk_control'],
    preferredExerciseIds: ['gentle-trunk-control'],
    excludedExerciseIds: [],
    regressions: {},
  },
  trace: [{
    ruleId: 'ARM_RAISE_TORSO_DRIFT', priority: 400, evidenceIds: ['obs-1'], effect: 'insight',
  }],
}

function reportInput(overrides: Partial<ComposeAssessmentReportInput> = {}): ComposeAssessmentReportInput {
  return {
    intake,
    route: standardRoute,
    coaching,
    freshness: 'fresh',
    assessment: {
      captureMode: 'camera',
      status: 'completed',
      overallConfidence: 0.88,
      completedAt: '2026-07-03T08:00:00.000Z',
    },
    generatedAt: '2026-07-03T08:01:00.000Z',
    ...overrides,
  }
}

describe('composeAssessmentReport', () => {
  it('selects one reliable free insight and keeps the plan paid', () => {
    const report = composeAssessmentReport(reportInput())

    assert.equal(report.status, 'ready')
    assert.equal(
      report.sections.filter(section => section.visibility === 'free' && section.kind === 'insight').length,
      1,
    )
    assert.equal(report.sections.find(section => section.kind === 'training_path')?.visibility, 'paid')
    assert.deepEqual(report.sections.find(section => section.kind === 'insight')?.evidenceIds, ['obs-1'])
  })

  it('persists personalized locked chapter titles from the deterministic plan', () => {
    const report = composeAssessmentReport(reportInput())
    const paid = report.sections.filter(section => section.visibility === 'paid')

    assert.equal(paid.length, 4)
    assert.ok(paid.every(section => section.title.toLowerCase().includes('trunk control')))
  })

  it('uses the highest-confidence allowed insight', () => {
    const lower = { ...coaching.insights[0], id: 'lower', confidence: 0.72 }
    const higher = {
      ...coaching.insights[0],
      id: 'higher',
      claimKey: 'rotation_difference' as const,
      confidence: 0.91,
      evidenceIds: ['obs-2'],
      focusArea: 'spine_mobility' as const,
    }
    const report = composeAssessmentReport(reportInput({
      coaching: { ...coaching, insights: [lower, higher] },
    }))

    assert.equal(report.sections.find(section => section.kind === 'insight')?.claimKey, 'rotation_difference')
  })

  it('never creates a numeric claim from self report', () => {
    const report = composeAssessmentReport(reportInput({
      assessment: { ...reportInput().assessment, captureMode: 'self_report' },
    }))

    assert.equal(report.status, 'insufficient_evidence')
    assert.ok(report.sections.every(section => (section.kind as string) !== 'numeric_observation'))
    assert.ok(report.sections.every(section => section.kind !== 'insight'))
  })

  it('retries instead of creating an insight below the confidence cutoff', () => {
    const report = composeAssessmentReport(reportInput({
      coaching: {
        ...coaching,
        insights: [{ ...coaching.insights[0], confidence: 0.69 }],
      },
      assessment: { ...reportInput().assessment, overallConfidence: 0.69, status: 'low_confidence' },
    }))

    assert.equal(report.status, 'insufficient_evidence')
    assert.ok(report.sections.some(section => section.kind === 'reassessment'))
    assert.ok(report.sections.every(section => section.kind !== 'insight'))
  })

  it('returns safety-only free output for stop', () => {
    const stopRoute: AssessmentRoute = {
      mode: 'stop', constraints: [], reasons: [{
        ruleId: 'CURRENT_STOP_SIGNAL',
        evidencePaths: ['safetySignals.sharp_pain'],
        userMessage: 'Pause movement and seek appropriate support.',
      }],
    }
    const report = composeAssessmentReport(reportInput({
      route: stopRoute,
      coaching: { ...coaching, safety: 'stop', insights: [], plan: { ...coaching.plan, preferredExerciseIds: [] } },
    }))

    assert.equal(report.status, 'safety_hold')
    assert.ok(report.sections.length > 0)
    assert.ok(report.sections.every(section => section.visibility === 'free'))
    assert.ok(report.sections.every(section => section.kind === 'safety'))
  })
})
