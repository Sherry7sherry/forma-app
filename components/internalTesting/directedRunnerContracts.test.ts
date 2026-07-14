import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('directed runner controls', () => {
  it('does not leak the tracking collector boolean through session overlay callbacks', () => {
    const source = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')
    const safeCallbacks = source.match(/onRecord=\{issue => \{\s*debugCollectorRef\.current\.record\('blocker', \{ issue: issue as never \}\)\s*\}\}/g)
    const safeForceContinues = source.match(/onForceContinue=\{\(\) => \{\s*internalSessionAdapter\.syntheticComplete\(`exercise:\$\{exercise\?\.name \?\? 'unknown'\}`\)\s*\}\}/g)

    assert.equal(safeCallbacks?.length, 2)
    assert.equal(safeForceContinues?.length, 2)
  })

  it('keeps the standing assessment separate from the supine Arm Arcs training profile', () => {
    const registry = readFileSync('lib/internalTesting/movementRegistry.ts', 'utf8')
    assert.match(registry, /id: 'assessment:side_arm_raise',[\s\S]*?exerciseName: 'Standing arm raise'/)
    assert.doesNotMatch(registry, /id: 'assessment:side_arm_raise',[\s\S]*?exerciseName: 'Arm Arcs'/)
  })

  it('gives every record action an immediate, visible success or failure state', () => {
    const overlay = readFileSync('components/internalTesting/InternalTestOverlay.tsx', 'utf8')
    const issueSheet = readFileSync('components/internalTesting/ReportIssueSheet.tsx', 'utf8')
    assert.match(overlay, /Saving internal test evidence/)
    assert.match(overlay, /Problem recorded/)
    assert.match(overlay, /Could not record/)
    assert.match(issueSheet, /Log issue/)
    assert.match(overlay, /Log \+ continue/)
    assert.match(overlay, /aria-live="polite"/)
  })

  it('records lightweight pose diagnostics without implying video capture', () => {
    const hook = readFileSync('components/internalTesting/useDirectedAttempt.ts', 'utf8')
    assert.match(hook, /recordPoseDiagnostics/)
    assert.match(hook, /eventType: 'pose_sample'/)
    assert.match(hook, /visibleLandmarks: diagnostics\.visibleLandmarks/)
    assert.match(hook, /is logging diagnostics/)
    assert.doesNotMatch(hook, /Blob|MediaRecorder|getDisplayMedia|videoFrame/)
    assert.doesNotMatch(hook, /is recording/)

    for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')
      assert.match(source, /recordPoseDiagnostics/)
      if (name === 'DirectedExerciseRunner.tsx') {
        assert.match(source, /onPoseResult=\{handlePoseResult\}/)
        assert.match(source, /recordPoseDiagnostics\(result\)/)
      } else {
        assert.match(source, /onPoseResult=\{recordPoseDiagnostics\}/)
      }
      assert.doesNotMatch(source, /onPoseResult=\{\(\)=>\{\}\}/)
    }
  })

  it('advances a directed assessment after a successful synthetic continuation', () => {
    const source = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    assert.match(source, /useRouter/)
    assert.match(source, /nextAssessmentScenario/)
    assert.match(source, /router\.push/)
    assert.match(source, /await forceContinue\(\)/)
  })

  it('passes the selected directed scenario phase into the exercise runner', () => {
    const page = readFileSync('app/internal/test-lab/run/page.tsx', 'utf8')
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')

    assert.match(page, /const scenario\s*=\s*parseTestScenario/)
    assert.match(page, /<DirectedExerciseRunner movement=\{movement\} scenario=\{parsedScenario\}/)
    assert.match(runner, /scenario:\s*TestScenario/)
    assert.match(runner, /useDirectedAttempt\(movement,\s*scenario\.phase\)/)
    assert.match(runner, /phase=\{scenario\.phase\}/)
    assert.doesNotMatch(runner, /useDirectedAttempt\(movement,\s*'calibrating'\)/)
    assert.doesNotMatch(runner, /phase="calibrating"/)
  })

  it('renders a mission board with exercise phase feedback and quick internal annotations', () => {
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const hook = readFileSync('components/internalTesting/useDirectedAttempt.ts', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')
    const mission = readFileSync('lib/internalTesting/exerciseMission.ts', 'utf8')

    assert.match(runner, /ExerciseMissionPanel/)
    assert.match(runner, /onQuickAction=\{recordQuickAction\}/)
    assert.match(runner, /onCountObserved=\{recordCountObservation\}/)
    assert.match(hook, /recordQuickAction/)
    assert.match(hook, /recordCountObservation/)
    assert.match(hook, /missionEventForQuickAction\('count-observed'/)
    assert.match(mission, /productionEvidence:\s*false/)
    assert.match(panel, /scenario\.phase === 'exercising' &&/)
  })

  it('shares the production rep counter with the directed exercise lab', () => {
    const session = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(session, /from '@\/lib\/repCounting\/productionRepCounter'/)
    assert.match(session, /useProductionRepCounter/)
    assert.match(session, /processAutoRepRef\.current = result => processRepPose\(result\)/)
    assert.match(session, /describeAiRepStatus/)
    assert.match(session, /requiredVisibleLandmarks/)
    assert.doesNotMatch(session, /function describeAiRepStatus/)
    assert.doesNotMatch(session, /function requiredVisibleLandmarks/)
    assert.doesNotMatch(session, /function processAutoRep/)
    assert.doesNotMatch(session, /normalizedPoseDistance|repBaselineRef|repCooldownRef/)
    assert.match(runner, /useProductionRepCounter/)
    assert.match(runner, /recordAiCountObservation/)
    assert.match(panel, /AI count/)
    assert.match(panel, /counter\.status\.chip/)
    assert.doesNotMatch(runner, /normalizedPoseDistance|engageThreshold|returnThreshold/)
  })

  for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
    it(`${name} persists report and force-continue actions`, () => {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')
      assert.match(source, /useDirectedAttempt/)
      assert.match(source, /onRecord=\{recordIssue\}/)
      assert.match(source, name === 'DirectedAssessmentRunner.tsx'
        ? /onForceContinue=\{continueToNextMovement\}/
        : /onForceContinue=\{forceContinue\}/)
      assert.doesNotMatch(source, /onRecord=\{\(\)=>\{\}\}/)
      assert.doesNotMatch(source, /onForceContinue=\{\(\)=>\{\}\}/)
    })
  }
})
