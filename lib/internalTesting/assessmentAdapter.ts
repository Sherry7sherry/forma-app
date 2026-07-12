export function createAssessmentTestAdapter(record:(event:unknown)=>void){
  const covered=new Set<string>()
  return {covered,record,retry:(phase:string)=>record({eventType:'retry',data:{phase}}),cameraUnavailable:(movementId:string)=>record({eventType:'blocker',data:{movementId,reason:'camera-unavailable'}}),lowConfidence:(movementId:string,confidence:number)=>record({eventType:'blocker',data:{movementId,reason:'low-confidence',confidence}}),syntheticComplete:(movementId:string,reason:string)=>{covered.add(movementId);record({eventType:'synthetic_transition',data:{movementId,reason,productionEvidence:false}});return{synthetic:true as const,productionObservations:[] as const}},endCoverage:()=>record({eventType:'attempt_end',data:{covered:[...covered]}})}
}
export type InternalAssessmentTestAdapter=ReturnType<typeof createAssessmentTestAdapter>
