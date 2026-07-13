'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { captureEnvironment } from '@/lib/internalTesting/clientSession'
import type { TestableMovement } from '@/lib/internalTesting/types'
import type { PoseResult } from '@/components/camera/PoseCamera'

const DIAGNOSTIC_SAMPLE_INTERVAL_MS = 500

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
  const lastPoseDiagnosticAtRef = useRef(0)

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
          setNotice(`Attempt ${attempt.attempt.id.slice(0, 8)} is logging diagnostics.`)
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
    setNotice('Problem logged. You can retry or log and continue.')
  }, [append])

  const recordPoseDiagnostics = useCallback((result: PoseResult) => {
    if (!attemptId) return
    const now = Date.now()
    if (now - lastPoseDiagnosticAtRef.current < DIAGNOSTIC_SAMPLE_INTERVAL_MS) return
    lastPoseDiagnosticAtRef.current = now
    const diagnostics = result.diagnostics
    void append({
      eventType: 'pose_sample',
      elapsedMs: 0,
      data: {
        movementId: movement.id,
        movementName: movement.displayName,
        phase,
        framingStatus: result.framingStatus,
        formScore: result.formScore,
        feedbackTypes: result.feedback.map(item => item.type),
        bodyConfidence: Number(result.bodyConfidence.toFixed(3)),
        sourceWidth: diagnostics.sourceWidth,
        sourceHeight: diagnostics.sourceHeight,
        detectionWidth: diagnostics.detectionWidth,
        detectionHeight: diagnostics.detectionHeight,
        visibleLandmarks: diagnostics.visibleLandmarks,
        trackedLandmarks: diagnostics.trackedLandmarks,
        detectionFps: Number(diagnostics.detectionFps.toFixed(1)),
        deviceClass: diagnostics.deviceClass,
        orientation: diagnostics.orientation,
        inputKind: diagnostics.inputKind,
        modelComplexity: diagnostics.modelComplexity,
      },
    }).catch(error => {
      setNotice(`Unable to record diagnostics: ${error instanceof Error ? error.message : 'unknown error'}`)
    })
  }, [append, attemptId, movement.displayName, movement.id, phase])

  const forceContinue = useCallback(async () => {
    await append({ eventType: 'synthetic_transition', elapsedMs: 0, reason: 'tester-force-continue', synthetic: true })
    await request(`/api/internal-tests/attempts/${attemptId}/complete`, { status: 'skipped', synthetic: true })
    setNotice('Synthetic continuation recorded. This did not update production data.')
  }, [append, attemptId])

  return { notice, recordIssue, recordPoseDiagnostics, forceContinue }
}
