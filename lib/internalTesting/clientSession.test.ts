import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DiagnosticSession, retryDisposition } from './clientSession.js'
import { MemoryQueue } from './indexedQueue.js'
import { createExportPackage } from './exportPackage.js'

describe('diagnostic session', () => {
  it('moves through run, attempt, pending upload, and completion', async () => {
    const session = new DiagnosticSession(new MemoryQueue())
    session.startRun('r1'); session.startAttempt('a1'); await session.queueBatch([{ eventType: 'count' }])
    assert.equal(session.state, 'pending-upload')
    session.completeAttempt(); assert.equal(session.state, 'completed')
  })
  it('classifies retries and preserves ordered duplicate-free batches', async () => {
    assert.equal(retryDisposition(500), 'retry'); assert.equal(retryDisposition(400), 'permanent')
    const queue = new MemoryQueue(); await queue.put({ attemptId: 'a', sequence: 1, events: [] }); await queue.put({ attemptId: 'a', sequence: 0, events: [] }); await queue.put({ attemptId: 'a', sequence: 1, events: [] })
    assert.deepEqual((await queue.list()).map(x => x.sequence), [0, 1])
  })
  it('creates versioned checksum export packages', async () => {
    const pkg = await createExportPackage({ run: { id: 'r' }, attempts: [], events: [] })
    assert.equal(pkg.schemaVersion, 1); assert.match(pkg.checksum, /^[a-f0-9]{64}$/)
  })
})
