'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ExerciseMissionPanel } from './ExerciseMissionPanel'
import { InternalTestOverlay } from './InternalTestOverlay'
import { useDirectedAttempt } from './useDirectedAttempt'
import type { PoseResult } from '@/components/camera/PoseCamera'
import { FLOOR_EXERCISE_NAMES, getExerciseTrackingProfile } from '@/lib/exerciseTracking'
import {
  poseSnapshotFromResult,
  type ExerciseMissionPoseSnapshot,
  type ExerciseMissionQuickAction,
} from '@/lib/internalTesting/exerciseMission'
import type { TestScenario, TestScenarioPhase } from '@/lib/internalTesting/scenarios'
import type { ExerciseTestableMovement } from '@/lib/internalTesting/types'
import { useProductionRepCounter } from '@/lib/repCounting/useProductionRepCounter'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

function initialExercisePhase(scenario: TestScenario): TestScenarioPhase {
  return scenario.phase === 'full-run' ? 'calibrating' : scenario.phase
}

export function DirectedExerciseRunner({
  movement,
  scenario,
}: {
  movement: ExerciseTestableMovement
  scenario: TestScenario
}) {
  const isFullRun = scenario.phase === 'full-run'
  const [currentPhase, setCurrentPhase] = useState<TestScenarioPhase>(() => initialExercisePhase(scenario))
  const [pose, setPose] = useState<ExerciseMissionPoseSnapshot | null>(null)

  useEffect(() => {
    setCurrentPhase(initialExercisePhase(scenario))
    setPose(null)
  }, [movement.id, scenario])

  const {
    notice,
    recordIssue,
    recordPoseDiagnostics,
    recordQuickAction,
    recordCountObservation,
    recordAiCountObservation,
    forceContinue,
  } = useDirectedAttempt(movement, currentPhase)

  const isFloorExercise = FLOOR_EXERCISE_NAMES.has(movement.exerciseName)
  const trackingProfile = useMemo(
    () => getExerciseTrackingProfile(movement.exerciseName, isFloorExercise),
    [movement.exerciseName, isFloorExercise],
  )
  const counter = useProductionRepCounter({
    exerciseName: movement.exerciseName,
    trackingProfile,
    targetReps: scenario.repeats,
    enabled: currentPhase === 'exercising',
    onCount: recordAiCountObservation,
  })

  const advanceFullRun = useCallback(() => {
    if (isFullRun && currentPhase !== 'exercising') {
      setCurrentPhase('exercising')
      counter.reset(0)
    }
  }, [counter, currentPhase, isFullRun])

  const handleQuickAction = useCallback(async (action: ExerciseMissionQuickAction) => {
    await recordQuickAction(action)
    if (action === 'calibration-ready') advanceFullRun()
  }, [advanceFullRun, recordQuickAction])

  const continueCurrentPhase = useCallback(async () => {
    await forceContinue()
    advanceFullRun()
  }, [advanceFullRun, forceContinue])

  const handlePoseResult = useCallback((result: PoseResult) => {
    setPose(poseSnapshotFromResult(result))
    if (currentPhase === 'exercising') counter.processPose(result)
    recordPoseDiagnostics(result)
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
        overlayMode={currentPhase === 'calibrating' ? 'calibration' : 'minimal'}
        onPoseResult={handlePoseResult}
      />
      <ExerciseMissionPanel
        movement={movement}
        scenario={scenario}
        currentPhase={currentPhase}
        pose={pose}
        counter={counter}
        onQuickAction={handleQuickAction}
        onCountObserved={recordCountObservation}
      />
      <InternalTestOverlay
        movement={movement.displayName}
        phase={currentPhase}
        notice={notice}
        onRecord={recordIssue}
        onRetry={() => location.reload()}
        onForceContinue={continueCurrentPhase}
        onEnd={() => history.back()}
      />
    </div>
  )
}
