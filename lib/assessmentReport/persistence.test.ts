import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import type { AssessmentIntake, AssessmentRoute } from '../assessmentIntake/index.js'
import {
  buildHealthIntakeVersionInsert,
  buildReportVersionInsert,
} from './persistence.js'

const migrationPath = 'supabase/migrations/008_assessment_intake_reports.sql'

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

const route: AssessmentRoute = { mode: 'standard', constraints: [], reasons: [] }

describe('assessment intake and report migration', () => {
  it('creates immutable owned version tables with evidence links and RLS', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    for (const table of ['health_intake_versions', 'body_report_versions']) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
      assert.match(sql, new RegExp(`on public\\.${table} for all[\\s\\S]*?using \\(auth\\.uid\\(\\) = user_id\\)[\\s\\S]*?with check \\(auth\\.uid\\(\\) = user_id\\)`, 'i'))
    }

    assert.match(sql, /body_report_versions[\s\S]*assessment_id\s+uuid/is)
    assert.match(sql, /body_report_versions[\s\S]*intake_version_id\s+uuid/is)
    assert.match(sql, /evidence_refs\s+jsonb\s+not null/is)
    assert.doesNotMatch(sql, /raw_video|video_url|guest_email/i)
  })

  it('extends the persisted stop list without removing existing signals', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    assert.match(sql, /drop constraint if exists body_check_ins_safety_signals_check/i)
    for (const signal of [
      'sharp_pain', 'numbness', 'radiating_pain', 'dizziness',
      'chest_pain', 'shortness_of_breath', 'sudden_weakness', 'professional_pause',
    ]) {
      assert.match(sql, new RegExp(`'${signal}'`))
    }
  })
})

describe('assessment report persistence payloads', () => {
  it('builds an owned, consented intake snapshot', () => {
    assert.deepEqual(buildHealthIntakeVersionInsert({
      authenticatedUserId: 'user-1',
      userId: 'user-1',
      assessmentId: 'assessment-1',
      intake,
      route,
      consentVersion: '2026-07-02',
      planPreferences: { availableMinutes: 5 },
    }), {
      user_id: 'user-1',
      assessment_id: 'assessment-1',
      intake_version: 1,
      answers: intake,
      safety_state: 'standard',
      constraints: [],
      plan_preferences: { availableMinutes: 5 },
      consent_version: '2026-07-02',
    })
  })

  it('rejects ownership mismatch and missing save consent', () => {
    assert.throws(() => buildHealthIntakeVersionInsert({
      authenticatedUserId: 'user-1', userId: 'user-2', assessmentId: null,
      intake, route, consentVersion: '2026-07-02', planPreferences: {},
    }), /authenticated user/i)
    assert.throws(() => buildHealthIntakeVersionInsert({
      authenticatedUserId: 'user-1', userId: 'user-1', assessmentId: null,
      intake, route, consentVersion: '', planPreferences: {},
    }), /consent/i)
  })

  it('requires traceable report evidence and approved claim keys', () => {
    const base = {
      authenticatedUserId: 'user-1',
      userId: 'user-1',
      assessmentId: 'assessment-1',
      intakeVersionId: 'intake-1',
      reportVersion: 1,
      engineVersion: '1.0.0',
      report: {
        status: 'ready',
        sections: [{ claimKey: 'arm_raise_torso_drift', evidenceIds: ['obs-1'] }],
      },
      evidenceRefs: ['obs-1'],
      changeSummary: null,
    } as const

    assert.equal(buildReportVersionInsert(base).evidence_refs[0], 'obs-1')
    assert.throws(() => buildReportVersionInsert({ ...base, evidenceRefs: [] }), /evidence/i)
    assert.throws(() => buildReportVersionInsert({
      ...base,
      report: { status: 'ready', sections: [{ claimKey: 'diagnosed_scoliosis', evidenceIds: ['obs-1'] }] },
    }), /claim key/i)
    assert.throws(() => buildReportVersionInsert({ ...base, userId: 'user-2' }), /authenticated user/i)
  })
})
