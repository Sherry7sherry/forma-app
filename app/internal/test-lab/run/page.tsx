import Link from 'next/link'
import { DirectedAssessmentRunner } from '@/components/internalTesting/DirectedAssessmentRunner'
import { DirectedExerciseRunner } from '@/components/internalTesting/DirectedExerciseRunner'
import { getTestableMovement } from '@/lib/internalTesting/movementRegistry'
import { parseTestScenario } from '@/lib/internalTesting/scenarios'
export default async function DirectedRunPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams
  let movement:ReturnType<typeof getTestableMovement>
  try { movement=getTestableMovement(parseTestScenario(new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined) as [string,string][])).movementId) }
  catch { movement=undefined }
  if(!movement)return <main className="p-6"><h1 className="text-xl font-semibold">Invalid test scenario</h1><Link href="/internal/test-lab" className="btn-primary mt-4">Back to test lab</Link></main>
  return movement.kind==='assessment'?<DirectedAssessmentRunner movement={movement}/>:<DirectedExerciseRunner movement={movement}/>
}
