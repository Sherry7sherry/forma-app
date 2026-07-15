'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ExerciseMissionPanel } from './ExerciseMissionPanel'
import { InternalTestOverlay } from './InternalTestOverlay'
import { useDirectedAttempt } from './useDirectedAttempt'
import type { PoseResult } from '@/components/camera/PoseCamera'
import { getExerciseTrackingProfile } from '@/lib/exerciseTracking'
import {
  poseSnapshotFromResult,
  type ExerciseMissionCountEvidence,
  type ExerciseMissionPhase,
  type ExerciseMissionPoseSnapshot,
  type ExerciseMissionQuickAction,
} from '@/lib/internalTesting/exerciseMission'
import { nextAssessmentScenario } from '@/lib/internalTesting/assessmentSequence'
import type { TestScenario } from '@/lib/internalTesting/scenarios'
import type { AssessmentTestableMovement } from '@/lib/internalTesting/types'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

function initialAssessmentPhase(scenario: TestScenario): ExerciseMissionPhase {
  return scenario.phase === 'full-run' || scenario.phase === 'setup' ? 'camera' : scenario.phase
}

export function DirectedAssessmentRunner({
  movement,
  scenario,
}: {
  movement: AssessmentTestableMovement
  scenario: TestScenario
}) {
  const router = useRouter()
  const isFullRun = scenario.phase === 'full-run' || scenario.phase === 'setup'
  const [currentPhase, setCurrentPhase] = useState<ExerciseMissionPhase>(() => initialAssessmentPhase(scenario))
  const [pose, setPose] = useState<ExerciseMissionPoseSnapshot | null>(null)
  const attemptPhase = scenario.phase === 'full-run' ? 'full-run' : currentPhase
  const trackingProfile = useMemo(
    () => getExerciseTrackingProfile(movement.exerciseName, false),
    [movement.exerciseName],
  )

  useEffect(() => {
    setCurrentPhase(initialAssessmentPhase(scenario))
    setPose(null)
  }, [movement.id, scenario])

  const {
    notice,
    recordIssue,
    recordPoseDiagnostics,
    recordQuickAction,
    recordCountObservation,
    forceContinue,
  } = useDirectedAttempt(movement, attemptPhase)

  const nextAssessmentUrl = useCallback(() => {
    const next = nextAssessmentScenario(movement.id)
    return next ? `/internal/test-lab/run?${next}` : '/internal/test-lab'
  }, [movement.id])

  const advanceFullRun = useCallback((action: ExerciseMissionQuickAction) => {
    if (!isFullRun) return
    if (action === 'camera-pass') setCurrentPhase('calibrating')
    if (action === 'calibration-pass' || action === 'calibration-ready') setCurrentPhase('capture')
  }, [isFullRun])

  const handleQuickAction = useCallback(async (
    action: ExerciseMissionQuickAction,
    evidence: ExerciseMissionCountEvidence = {},
  ) => {
    const persistence = recordQuickAction(action, currentPhase, evidence)
    if (action === 'count-pass') {
      await persistence
      router.push(nextAssessmentUrl())
      return
    }
    advanceFullRun(action)
    await persistence
  }, [advanceFullRun, currentPhase, nextAssessmentUrl, recordQuickAction, router])

  const continueToNextMovement = useCallback(async () => {
    await forceContinue(currentPhase)
    router.push(nextAssessmentUrl())
  }, [currentPhase, forceContinue, nextAssessmentUrl, router])

  const handlePoseResult = useCallback((result: PoseResult) => {
    setPose(poseSnapshotFromResult(result, {
      landmarks: trackingProfile.landmarks,
      minVisibility: trackingProfile.minVisibility,
    }))
    recordPoseDiagnostics(result, currentPhase)
  }, [currentPhase, recordPoseDiagnostics, trackingProfile])

  return (
    <div className="min-h-dvh bg-charcoal">
      <PoseCamera
        exerciseName={movement.exerciseName}
        formScoreSupported={false}
        cameraOrientation={trackingProfile.cameraOrientation}
        trackingLandmarks={trackingProfile.landmarks}
        trackingMinVisibility={trackingProfile.minVisibility}
        fill
        overlayMode={currentPhase === 'camera' || currentPhase === 'calibrating' ? 'calibration' : 'minimal'}
        posePrecision="assessment"
        framingRequirement={movement.postureFamily === 'seated' ? 'seated-torso' : 'full-body'}
        onPoseResult={handlePoseResult}
      />
      <ExerciseMissionPanel
        movement={movement}
        scenario={scenario}
        currentPhase={currentPhase}
        pose={pose}
        onQuickAction={handleQuickAction}
        onCountObserved={(count, evidence) => recordCountObservation(count, currentPhase, evidence)}
      />
      <InternalTestOverlay
        movement={movement.displayName}
        phase={currentPhase}
        notice={notice}
        onRecord={recordIssue}
        onRetry={() => location.reload()}
        onForceContinue={continueToNextMovement}
        onEnd={() => history.back()}
      />
    </div>
  )
}
