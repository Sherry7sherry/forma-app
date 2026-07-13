'use client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { InternalTestOverlay } from './InternalTestOverlay'
import type { AssessmentTestableMovement } from '@/lib/internalTesting/types'
import { useDirectedAttempt } from './useDirectedAttempt'
import { nextAssessmentScenario } from '@/lib/internalTesting/assessmentSequence'
const PoseCamera=dynamic(()=>import('@/components/camera/PoseCamera'),{ssr:false})
export function DirectedAssessmentRunner({movement}:{movement:AssessmentTestableMovement}){const router=useRouter();const{notice,recordIssue,recordPoseDiagnostics,forceContinue}=useDirectedAttempt(movement,'capture');async function continueToNextMovement(){await forceContinue();const scenario=nextAssessmentScenario(movement.id);router.push(scenario?`/internal/test-lab/run?${scenario}`:'/internal/test-lab')}return <div className="min-h-dvh bg-charcoal"><PoseCamera exerciseName={movement.exerciseName} formScoreSupported={false} fill overlayMode="minimal" posePrecision="assessment" onPoseResult={recordPoseDiagnostics}/><InternalTestOverlay movement={movement.displayName} phase="capture" notice={notice} onRecord={recordIssue} onRetry={()=>location.reload()} onForceContinue={continueToNextMovement} onEnd={()=>history.back()}/></div>}
