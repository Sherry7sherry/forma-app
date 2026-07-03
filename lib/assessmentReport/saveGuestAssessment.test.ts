import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GuestAssessmentPayload } from '../assessmentIntake/index.js'
import {
  saveGuestAssessment,
  type GuestAssessmentPersistence,
  type TransferRecord,
} from './saveGuestAssessment.js'

const payload: GuestAssessmentPayload = {
  schemaVersion: 1,
  createdAt: '2026-07-03T08:00:00.000Z',
  consentVersion: '2026-07-02',
  lastCompletedStep: 7,
  intake: {
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
  },
  route: { mode: 'standard', constraints: [], reasons: [] },
  capture: {
    status: 'completed',
    overallConfidence: 0.88,
    completedAt: '2026-07-03T08:04:00.000Z',
    observations: [{
      movementKey: 'side_arm_raise',
      dimension: 'control',
      side: 'bilateral',
      metricKey: 'torso_drift_ratio',
      value: 0.16,
      unit: 'ratio',
      betterDirection: 'lower',
      changeThreshold: 0.04,
      confidence: 0.88,
    }],
  },
}

class MemoryAdapter implements GuestAssessmentPersistence {
  calls: string[] = []
  assessments = new Map<string, string>()
  observations = new Map<string, string[]>()
  intakes = new Map<string, string>()
  reports = new Map<string, string>()
  transfers = new Map<string, TransferRecord>()
  failReportOnce = false

  async findTransfer(transferId: string) {
    this.calls.push('findTransfer')
    return this.transfers.get(transferId) ?? null
  }

  async ensureAssessment(input: { transferId: string }) {
    this.calls.push('assessment')
    const id = this.assessments.get(input.transferId) ?? input.transferId
    this.assessments.set(input.transferId, id)
    return id
  }

  async ensureObservations(input: { transferId: string; observations: unknown[] }) {
    this.calls.push('observations')
    const ids = this.observations.get(input.transferId)
      ?? input.observations.map((_, index) => `observation-${index + 1}`)
    this.observations.set(input.transferId, ids)
    return ids
  }

  async ensureIntakeVersion(input: { transferId: string }) {
    this.calls.push('intake')
    const id = this.intakes.get(input.transferId) ?? 'intake-1'
    this.intakes.set(input.transferId, id)
    return id
  }

  async ensureReport(input: { transferId: string }) {
    this.calls.push('report')
    if (this.failReportOnce) {
      this.failReportOnce = false
      throw new Error('report insert failed')
    }
    const id = this.reports.get(input.transferId) ?? 'report-1'
    this.reports.set(input.transferId, id)
    return id
  }

  async completeTransfer(input: TransferRecord & { transferId: string }) {
    this.calls.push('complete')
    this.transfers.set(input.transferId, {
      assessmentId: input.assessmentId,
      reportId: input.reportId,
    })
  }
}

describe('saveGuestAssessment', () => {
  it('persists assessment, observations, intake, report, then completion marker', async () => {
    const adapter = new MemoryAdapter()
    const result = await saveGuestAssessment({
      userId: 'user-1', transferId: 'transfer-1', payload,
      now: new Date('2026-07-03T09:00:00.000Z'),
    }, adapter)

    assert.deepEqual(result, { assessmentId: 'transfer-1', reportId: 'report-1' })
    assert.deepEqual(adapter.calls, [
      'findTransfer', 'assessment', 'observations', 'intake', 'report', 'complete',
    ])
  })

  it('retries after report failure without duplicating earlier durable rows', async () => {
    const adapter = new MemoryAdapter()
    adapter.failReportOnce = true
    const input = {
      userId: 'user-1', transferId: 'transfer-1', payload,
      now: new Date('2026-07-03T09:00:00.000Z'),
    }

    await assert.rejects(() => saveGuestAssessment(input, adapter), /report insert failed/)
    await saveGuestAssessment(input, adapter)

    assert.equal(adapter.assessments.size, 1)
    assert.equal(adapter.observations.size, 1)
    assert.equal(adapter.intakes.size, 1)
    assert.equal(adapter.reports.size, 1)
  })

  it('returns an existing completed transfer without writing again', async () => {
    const adapter = new MemoryAdapter()
    adapter.transfers.set('transfer-1', { assessmentId: 'assessment-1', reportId: 'report-1' })

    assert.deepEqual(await saveGuestAssessment({
      userId: 'user-1', transferId: 'transfer-1', payload,
      now: new Date('2026-07-03T09:00:00.000Z'),
    }, adapter), { assessmentId: 'assessment-1', reportId: 'report-1' })
    assert.deepEqual(adapter.calls, ['findTransfer'])
  })

  it('never saves numeric observations from stop, expired, or low-confidence payloads', async () => {
    for (const unsafePayload of [
      { ...payload, route: { mode: 'stop', constraints: [], reasons: [] } } as GuestAssessmentPayload,
      { ...payload, createdAt: '2026-07-01T08:00:00.000Z' } as GuestAssessmentPayload,
      { ...payload, capture: { ...payload.capture!, overallConfidence: 0.69 } } as unknown as GuestAssessmentPayload,
    ]) {
      const adapter = new MemoryAdapter()
      await assert.rejects(() => saveGuestAssessment({
        userId: 'user-1', transferId: 'transfer-1', payload: unsafePayload,
        now: new Date('2026-07-03T09:00:00.000Z'),
      }, adapter))
      assert.equal(adapter.observations.size, 0)
    }
  })
})
