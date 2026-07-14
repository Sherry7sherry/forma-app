'use client'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { InternalTestOverlay } from './InternalTestOverlay'
import { ExerciseMissionPanel } from './ExerciseMissionPanel'
import type { ExerciseTestableMovement } from '@/lib/internalTesting/types'
import type { TestScenario } from '@/lib/internalTesting/scenarios'
import { FLOOR_EXERCISE_NAMES, getExerciseTrackingProfile } from '@/lib/exerciseTracking'
import { poseSnapshotFromResult, type ExerciseMissionPoseSnapshot } from '@/lib/internalTesting/exerciseMission'
import { useProductionRepCounter } from '@/lib/repCounting/useProductionRepCounter'
import type { PoseResult } from '@/components/camera/PoseCamera'
import { useDirectedAttempt } from './useDirectedAttempt'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedExerciseRunner({movement,scenario}:{movement:ExerciseTestableMovement;scenario:TestScenario}){
  const{notice,recordIssue,recordPoseDiagnostics,recordQuickAction,recordCountObservation,recordAiCountObservation,forceContinue}=useDirectedAttempt(movement,scenario.phase)
  const[pose,setPose]=useState<ExerciseMissionPoseSnapshot|null>(null)
  const isFloorExercise=FLOOR_EXERCISE_NAMES.has(movement.exerciseName)
  const trackingProfile=useMemo(()=>getExerciseTrackingProfile(movement.exerciseName,isFloorExercise),[movement.exerciseName,isFloorExercise])
  const counter=useProductionRepCounter({exerciseName:movement.exerciseName,trackingProfile,targetReps:scenario.repeats,enabled:scenario.phase==='exercising',onCount:recordAiCountObservation})
  const handlePoseResult=useCallback((result:PoseResult)=>{setPose(poseSnapshotFromResult(result));if(scenario.phase==='exercising')counter.processPose(result);recordPoseDiagnostics(result)},[counter,recordPoseDiagnostics,scenario.phase])
  return <div className="min-h-dvh bg-charcoal">
    <PoseCamera exerciseName={movement.exerciseName} isFloorExercise={isFloorExercise} formScoreSupported={!isFloorExercise} cameraOrientation={trackingProfile.cameraOrientation} trackingLandmarks={trackingProfile.landmarks} trackingMinVisibility={trackingProfile.minVisibility} fill overlayMode={scenario.phase==='calibrating'?'calibration':'minimal'} onPoseResult={handlePoseResult}/>
    <ExerciseMissionPanel movement={movement} scenario={scenario} pose={pose} counter={counter} onQuickAction={recordQuickAction} onCountObserved={recordCountObservation}/>
    <InternalTestOverlay movement={movement.displayName} phase={scenario.phase} notice={notice} onRecord={recordIssue} onRetry={()=>location.reload()} onForceContinue={forceContinue} onEnd={()=>history.back()}/>
  </div>
}
