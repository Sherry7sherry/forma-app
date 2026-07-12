import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSessionTestAdapter } from './sessionAdapter.js'
describe('session adapter',()=>{it('routes test controls without creating production completion data',()=>{const calls:string[]=[];const adapter=createSessionTestAdapter({retry:()=>calls.push('retry'),start:()=>calls.push('start'),setCount:n=>calls.push(`count:${n}`),advance:()=>calls.push('advance'),record:()=>{}});adapter.retryCalibration();adapter.startExercising();adapter.supplyRepetitions(4);const result=adapter.syntheticComplete('exercise:x');assert.deepEqual(calls,['retry','start','count:4','advance']);assert.deepEqual(result,{productionCompletion:false,productionScore:false,productionSummary:false,productionAnalytics:false})})})
