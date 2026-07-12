import assert from 'node:assert/strict'
import { describe,it } from 'node:test'
import { buildAttemptFilters, summarizeAttempt } from './queries.js'
describe('internal test queries',()=>{it('builds safe filters and tester-safe summaries',()=>{assert.deepEqual(buildAttemptFilters({status:'blocked',movementId:'exercise:glute-bridge'}),{status:'blocked',movementId:'exercise:glute-bridge'});const summary=summarizeAttempt({id:'a',movement_id:'exercise:glute-bridge',status:'blocked',summary:{note:'x',secret:'no'}});assert.deepEqual(summary,{id:'a',movementId:'exercise:glute-bridge',status:'blocked',note:'x'})});it('rejects unsupported filters',()=>assert.throws(()=>buildAttemptFilters({status:'bad'})))})
