'use client'
import dynamic from 'next/dynamic'
import { InternalTestOverlay } from './InternalTestOverlay'
import type { AssessmentTestableMovement } from '@/lib/internalTesting/types'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedAssessmentRunner({movement}:{movement:AssessmentTestableMovement}){return <div className="min-h-dvh bg-charcoal"><PoseCamera exerciseName={movement.exerciseName} formScoreSupported={false} fill overlayMode="minimal" posePrecision="assessment" onPoseResult={()=>{}}/><InternalTestOverlay movement={movement.displayName} phase="capture" onRecord={()=>{}} onRetry={()=>location.reload()} onForceContinue={()=>{}} onEnd={()=>history.back()}/></div>}
