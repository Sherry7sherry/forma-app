import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TrackingEventCollector, createTrackingEvent } from './trackingEvents.js'

const context = {
  attemptId: 'attempt-1', movementId: 'exercise:glute-bridge', movementName: 'Glute Bridge',
  buildVersion: 'build-7', profileVersion: 'profile-2', startedAtMs: 1_000,
}

describe('tracking event diagnostics', () => {
  it('captures complete calibration blocker evidence', () => {
    const event = createTrackingEvent(context, 'blocker', {
      expectedOrientation: 'landscape', actualOrientation: 'portrait', visibleLandmarks: 4,
      requiredLandmarks: 7, bodyConfidence: 0.31, confidenceThreshold: 0.42,
      engageThreshold: 0.16, returnThreshold: 0.065,
    }, { nowMs: 1_450, wallClock: '2026-07-12T00:00:00.000Z' })
    assert.equal(event.elapsedMs, 450)
    assert.equal(event.timestamp, '2026-07-12T00:00:00.000Z')
    assert.deepEqual(event.data, {
      expectedOrientation: 'landscape', actualOrientation: 'portrait', visibleLandmarks: 4,
      requiredLandmarks: 7, bodyConfidence: 0.31, confidenceThreshold: 0.42,
      engageThreshold: 0.16, returnThreshold: 0.065,
    })
  })

  it('throttles pose samples without dropping important events', () => {
    const collector = new TrackingEventCollector(context, { poseSampleIntervalMs: 500 })
    assert.equal(collector.record('pose_sample', { value: 1 }, { nowMs: 1_000 }), true)
    assert.equal(collector.record('pose_sample', { value: 2 }, { nowMs: 1_200 }), false)
    assert.equal(collector.record('phase_change', { phase: 'active' }, { nowMs: 1_201 }), true)
    assert.equal(collector.record('count', { count: 1 }, { nowMs: 1_202 }), true)
    assert.equal(collector.record('blocker', { reason: 'framing' }, { nowMs: 1_203 }), true)
    assert.equal(collector.snapshot().length, 4)
  })

  it('evicts oldest events at the configured limit', () => {
    const collector = new TrackingEventCollector(context, { limit: 2 })
    collector.record('count', { count: 1 }, { nowMs: 1_001 })
    collector.record('count', { count: 2 }, { nowMs: 1_002 })
    collector.record('count', { count: 3 }, { nowMs: 1_003 })
    assert.deepEqual(collector.snapshot().map(event => event.data.count), [2, 3])
  })

  it('includes stable context and serializes to JSON', () => {
    const event = createTrackingEvent(context, 'feedback', { cue: 'Good' }, { nowMs: 2_000 })
    assert.equal(event.attemptId, 'attempt-1')
    assert.equal(event.movementId, 'exercise:glute-bridge')
    assert.equal(event.movementName, 'Glute Bridge')
    assert.equal(event.buildVersion, 'build-7')
    assert.equal(event.profileVersion, 'profile-2')
    assert.doesNotThrow(() => JSON.stringify(event))
  })

  it('rejects browser and service objects from payloads', () => {
    for (const value of [() => undefined, { nodeType: 1 }, { getTracks() { return [] } }, { from() {} }]) {
      assert.throws(() => createTrackingEvent(context, 'pose_sample', { value } as never))
    }
  })
})
