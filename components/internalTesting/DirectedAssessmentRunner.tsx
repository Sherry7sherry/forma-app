'use client'
import dynamic from 'next/dynamic'
import { InternalTestOverlay } from './InternalTestOverlay'
import type { AssessmentTestableMovement } from '@/lib/internalTesting/types'
import { useDirectedAttempt } from './useDirectedAttempt'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedAssessmentRunner({movement}:{movement:AssessmentTestableMovement}){const{notice,recordIssue,forceContinue}=useDirectedAttempt(movement,'capture');return <div className="min-h-dvh bg-charcoal"><PoseCamera exerciseName={movement.exerciseName} formScoreSupported={false} fill overlayMode="minimal" posePrecision="assessment" onPoseResult={()=>{}}/><InternalTestOverlay movement={movement.displayName} phase="capture" notice={notice} onRecord={recordIssue} onRetry={()=>location.reload()} onForceContinue={forceContinue} onEnd={()=>history.back()}/></div>}
