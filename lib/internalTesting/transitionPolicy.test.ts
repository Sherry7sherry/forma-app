import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decideTransition } from './transitionPolicy.js'

describe('synthetic transition policy', () => {
  const cases = [
    ['assessment','setup','retry-phase','setup'], ['assessment','capture','camera-unavailable','completed'],
    ['session','calibrating','calibration-passed','calibrating-ready'], ['session','calibrating-ready','start-exercising','exercising'],
    ['session','exercising','supply-actual-repetitions','exercising'], ['session','exercising','complete-movement','completed'],
    ['session','persistence-failed','continue-pending-persistence','completed'],
  ] as const
  for (const [flow,phase,command,next] of cases) it(`allows ${flow} ${phase} ${command}`,()=>{ const input = command==='supply-actual-repetitions' ? {type:command,reason:'blocked',count:3} as const : {type:command,reason:'blocked'} as const; const result=decideTransition({flow,phase,ended:false},input); assert.equal(result.ok,true); if(result.ok){ assert.equal(result.next.phase,next); assert.equal(result.event.eventType,'synthetic_transition'); assert.equal(result.event.data.reason,'blocked') } })
  it('denies unrelated, invalid-count, and ended transitions',()=>{ assert.equal(decideTransition({flow:'assessment',phase:'setup',ended:false},{type:'start-exercising',reason:'x'}).ok,false); assert.equal(decideTransition({flow:'session',phase:'exercising',ended:false},{type:'supply-actual-repetitions',reason:'x',count:-1}).ok,false); assert.equal(decideTransition({flow:'session',phase:'exercising',ended:true},{type:'complete-movement',reason:'x'}).ok,false) })
})
