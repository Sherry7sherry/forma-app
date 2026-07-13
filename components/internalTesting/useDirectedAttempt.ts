'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { captureEnvironment } from '@/lib/internalTesting/clientSession'
import type { TestableMovement } from '@/lib/internalTesting/types'

async function request(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error?.code ?? `request_failed_${response.status}`)
  return payload
}

export function useDirectedAttempt(movement: TestableMovement, phase: string) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [notice, setNotice] = useState('Preparing internal test attempt…')
  const sequenceRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function createAttempt() {
      try {
        const run = await request('/api/internal-tests/runs', {
          sourceFlow: 'directed',
          buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'local',
          profileVersion: process.env.NEXT_PUBLIC_TRACKING_PROFILE_VERSION ?? '1',
          environment: captureEnvironment(),
        })
        const attempt = await request(`/api/internal-tests/runs/${run.run.id}/attempts`, {
          movementId: movement.id,
          phase,
        })
        if (!cancelled) {
          setAttemptId(attempt.attempt.id)
          setNotice(`Attempt ${attempt.attempt.id.slice(0, 8)} is recording.`)
        }
      } catch (error) {
        if (!cancelled) setNotice(`Unable to start attempt: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
    void createAttempt()
    return () => { cancelled = true }
  }, [movement.id, phase])

  const append = useCallback(async (event: unknown) => {
    if (!attemptId) throw new Error('attempt_not_ready')
    await request(`/api/internal-tests/attempts/${attemptId}/events`, {
      sequence: sequenceRef.current++,
      events: [event],
    })
  }, [attemptId])

  const recordIssue = useCallback(async (issue: unknown) => {
    await append({ eventType: 'blocker', elapsedMs: 0, issue })
    setNotice('Problem recorded. You can retry or record and continue.')
  }, [append])

  const forceContinue = useCallback(async () => {
    await append({ eventType: 'synthetic_transition', elapsedMs: 0, reason: 'tester-force-continue', synthetic: true })
    await request(`/api/internal-tests/attempts/${attemptId}/complete`, { status: 'skipped', synthetic: true })
    setNotice('Synthetic continuation recorded. This did not update production data.')
  }, [append, attemptId])

  return { notice, recordIssue, forceContinue }
}
