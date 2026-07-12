import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe,it } from 'node:test'
import { TESTABLE_MOVEMENTS } from './movementRegistry.js'
import { validateAttempt } from './persistence.js'
import { parseTestScenario,serializeTestScenario } from './scenarios.js'

describe('internal movement testing MVP contracts',()=>{
  it('gives each registry movement a valid attempt and scenario start',()=>{for(const movement of TESTABLE_MOVEMENTS){assert.equal(validateAttempt({runId:'r',movementId:movement.id,phase:'setup'}).movementId,movement.id);const scenario=movement.scenarios[0];assert.equal(parseTestScenario(serializeTestScenario({movementId:movement.id,phase:'setup',scenarioId:scenario.id,repeats:1})).movementId,movement.id)}})
  it('keeps synthetic assessment evidence outside report composition and observation inserts',()=>{const source=readFileSync('lib/internalTesting/assessmentAdapter.ts','utf8');assert.doesNotMatch(source,/buildObservationInserts|movement_observations|movement_assessments/);assert.match(source,/productionObservations:\[\]/)})
  it('keeps synthetic session results outside production completion, summaries, progress, and analytics',()=>{const source=readFileSync('lib/internalTesting/sessionAdapter.ts','utf8');for(const field of ['productionCompletion:false','productionScore:false','productionSummary:false','productionAnalytics:false'])assert.match(source,new RegExp(field))})
  it('keeps internal pages and APIs server-authorized',()=>{const auth=readFileSync('lib/internalTesting/auth.ts','utf8');assert.match(auth,/requireInternalTester/);assert.match(auth,/requireInternalApiTester/);const layout=readFileSync('app/internal/layout.tsx','utf8');assert.match(layout,/requireInternalTester/)})
  it('keeps failed packages exportable',()=>{const source=readFileSync('lib/internalTesting/exportPackage.ts','utf8');assert.match(source,/createExportPackage/);assert.match(source,/downloadExportPackage/)})
})
