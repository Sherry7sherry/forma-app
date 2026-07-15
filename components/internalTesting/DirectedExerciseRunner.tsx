'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ExerciseMissionPanel } from './ExerciseMissionPanel'
import { InternalTestOverlay } from './InternalTestOverlay'
import { useDirectedAttempt } from './useDirectedAttempt'
import type { PoseResult } from '@/components/camera/PoseCamera'
import { FLOOR_EXERCISE_NAMES, getExerciseTrackingProfile } from '@/lib/exerciseTracking'
import {
  poseSnapshotFromResult,
  type ExerciseMissionCountEvidence,
  type ExerciseMissionPoseSnapshot,
  type ExerciseMissionQuickAction,
} from '@/lib/internalTesting/exerciseMission'
import { nextExerciseScenario } from '@/lib/internalTesting/assessmentSequence'
import type { TestScenario, TestScenarioPhase } from '@/lib/internalTesting/scenarios'
import type { ExerciseTestableMovement } from '@/lib/internalTesting/types'
import { useProductionRepCounter } from '@/lib/repCounting/useProductionRepCounter'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

function initialExercisePhase(scenario: TestScenario): TestScenarioPhase {
  return scenario.phase === 'full-run' ? 'camera' : scenario.phase
}

export function DirectedExerciseRunner({
  movement,
  scenario,
}: {
  movement: ExerciseTestableMovement
  scenario: TestScenario
}) {
  const router = useRouter()
  const isFullRun = scenario.phase === 'full-run'
  const [currentPhase, setCurrentPhase] = useState<TestScenarioPhase>(() => initialExercisePhase(scenario))
  const [pose, setPose] = useState<ExerciseMissionPoseSnapshot | null>(null)

  useEffect(() => {
    setCurrentPhase(initialExercisePhase(scenario))
    setPose(null)
  }, [movement.id, scenario])
  const attemptPhase = scenario.phase === 'full-run' ? 'full-run' : currentPhase

  const {
    notice,
    recordIssue,
    recordPoseDiagnostics,
    recordQuickAction,
    recordCountObservation,
    recordAiCounterEvent: logAiCounterEvent,
    forceContinue,
  } = useDirectedAttempt(movement, attemptPhase)

  const isFloorExercise = FLOOR_EXERCISE_NAMES.has(movement.exerciseName)
  const trackingProfile = useMemo(
    () => getExerciseTrackingProfile(movement.exerciseName, isFloorExercise),
    [movement.exerciseName, isFloorExercise],
  )
  const countEvidenceBase = useMemo<ExerciseMissionCountEvidence>(() => ({
    targetReps: scenario.repeats,
    trackingMode: trackingProfile.mode,
    cameraOrientation: trackingProfile.cameraOrientation,
    engageThreshold: trackingProfile.engageThreshold,
    returnThreshold: trackingProfile.returnThreshold,
    minVisibleLandmarks: trackingProfile.minVisibleLandmarks,
    minVisibleRatio: trackingProfile.minVisibleRatio,
    confidenceThreshold: trackingProfile.confidenceThreshold,
  }), [scenario.repeats, trackingProfile])

  const recordAiCounterEvent = useCallback((event: Parameters<typeof logAiCounterEvent>[0]) => {
    void logAiCounterEvent(event, currentPhase, countEvidenceBase)
  }, [countEvidenceBase, currentPhase, logAiCounterEvent])

  const counter = useProductionRepCounter({
    exerciseName: movement.exerciseName,
    trackingProfile,
    targetReps: scenario.repeats,
    enabled: currentPhase === 'exercising',
    onEvent: recordAiCounterEvent,
  })

  const advanceFullRun = useCallback((action: ExerciseMissionQuickAction) => {
    if (!isFullRun) return
    if (action === 'camera-pass') setCurrentPhase('calibrating')
    if (action === 'calibration-pass' || action === 'calibration-ready') {
      setCurrentPhase('exercising')
      counter.reset(0)
    }
  }, [counter, isFullRun])

  const handleQuickAction = useCallback(async (action: ExerciseMissionQuickAction, evidence: ExerciseMissionCountEvidence = {}) => {
    await recordQuickAction(action, currentPhase, evidence)
    advanceFullRun(action)
  }, [advanceFullRun, currentPhase, recordQuickAction])

  const nextExerciseUrl = useCallback(() => {
    const next = nextExerciseScenario(movement.id, scenario.repeats)
    return next ? `/internal/test-lab/run?${next}` : '/internal/test-lab'
  }, [movement.id, scenario.repeats])

  const continueToNextMovement = useCallback(async () => {
    await forceContinue(currentPhase)
    router.push(nextExerciseUrl())
  }, [currentPhase, forceContinue, nextExerciseUrl, router])

  const handlePoseResult = useCallback((result: PoseResult) => {
    setPose(poseSnapshotFromResult(result))
    if (currentPhase === 'exercising') counter.processPose(result)
    recordPoseDiagnostics(result, currentPhase)
  }, [counter, currentPhase, recordPoseDiagnostics])

  return (
    <div className="min-h-dvh bg-charcoal">
      <PoseCamera
        exerciseName={movement.exerciseName}
        isFloorExercise={isFloorExercise}
        formScoreSupported={!isFloorExercise}
        cameraOrientation={trackingProfile.cameraOrientation}
        trackingLandmarks={trackingProfile.landmarks}
        trackingMinVisibility={trackingProfile.minVisibility}
        fill
        overlayMode={currentPhase === 'camera' || currentPhase === 'calibrating' ? 'calibration' : 'minimal'}
        onPoseResult={handlePoseResult}
      />
      <ExerciseMissionPanel
        movement={movement}
        scenario={scenario}
        currentPhase={currentPhase}
        pose={pose}
        counter={counter}
        countEvidence={countEvidenceBase}
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
