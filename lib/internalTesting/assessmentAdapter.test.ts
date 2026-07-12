import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAssessmentTestAdapter } from './assessmentAdapter.js'

describe('assessment adapter',()=>{
  it('records retries, camera blockers, low confidence, and synthetic coverage without production evidence',()=>{ const events:unknown[]=[]; const adapter=createAssessmentTestAdapter(event=>events.push(event)); adapter.retry('setup'); adapter.cameraUnavailable('assessment:side_arm_raise'); adapter.lowConfidence('assessment:side_arm_raise',.2); const result=adapter.syntheticComplete('assessment:side_arm_raise','blocked'); assert.equal(result.productionObservations.length,0); assert.equal(result.synthetic,true); assert.equal(events.length,4) })
  it('continues coverage to later assessment movements',()=>{ const adapter=createAssessmentTestAdapter(()=>{}); adapter.syntheticComplete('assessment:side_arm_raise','blocked'); assert.equal(adapter.covered.has('assessment:side_arm_raise'),true); assert.equal(adapter.covered.has('assessment:standing_roll_down'),false) })
})
