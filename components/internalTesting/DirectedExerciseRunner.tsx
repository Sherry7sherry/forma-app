'use client'
import dynamic from 'next/dynamic'
import { InternalTestOverlay } from './InternalTestOverlay'
import type { ExerciseTestableMovement } from '@/lib/internalTesting/types'
import { useDirectedAttempt } from './useDirectedAttempt'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedExerciseRunner({movement}:{movement:ExerciseTestableMovement}){const{notice,recordIssue,forceContinue}=useDirectedAttempt(movement,'calibrating');return <div className="min-h-dvh bg-charcoal"><PoseCamera exerciseName={movement.exerciseName} fill overlayMode="minimal" onPoseResult={()=>{}}/><InternalTestOverlay movement={movement.displayName} phase="calibrating" notice={notice} onRecord={recordIssue} onRetry={()=>location.reload()} onForceContinue={forceContinue} onEnd={()=>history.back()}/></div>}
