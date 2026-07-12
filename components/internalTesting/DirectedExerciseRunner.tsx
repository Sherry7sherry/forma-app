'use client'
import dynamic from 'next/dynamic'
import { InternalTestOverlay } from './InternalTestOverlay'
import type { ExerciseTestableMovement } from '@/lib/internalTesting/types'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedExerciseRunner({movement}:{movement:ExerciseTestableMovement}){return <div className="min-h-dvh bg-charcoal"><PoseCamera exerciseName={movement.exerciseName} fill overlayMode="minimal" onPoseResult={()=>{}}/><InternalTestOverlay movement={movement.displayName} phase="calibrating" onRecord={()=>{}} onRetry={()=>location.reload()} onForceContinue={()=>{}} onEnd={()=>history.back()}/></div>}
