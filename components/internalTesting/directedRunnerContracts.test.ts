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

  it('resets the issue form after a saved issue and when the attempt context changes', () => {
    const overlay = readFileSync('components/internalTesting/InternalTestOverlay.tsx', 'utf8')
    const issueSheet = readFileSync('components/internalTesting/ReportIssueSheet.tsx', 'utf8')

    assert.match(overlay, /resetKey=\{`\$\{movement\}:\$\{phase\}`\}/)
    assert.match(issueSheet, /resetKey/)
    assert.match(issueSheet, /useEffect/)
    assert.match(issueSheet, /resetForm/)
    assert.match(issueSheet, /await onSubmit/)
    assert.match(issueSheet, /setNote\(''\)/)
  })

  it('shows tester-friendly issue labels instead of internal issue slugs', () => {
    const issueSheet = readFileSync('components/internalTesting/ReportIssueSheet.tsx', 'utf8')

    assert.match(issueSheet, /INTERNAL_ISSUE_OPTIONS/)
    assert.match(issueSheet, /option\.label/)
    assert.match(issueSheet, /selectedIssue\?\.description/)
    assert.doesNotMatch(issueSheet, /INTERNAL_ISSUE_TYPES\.map/)
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
        assert.match(source, /recordPoseDiagnostics\(result,\s*currentPhase\)/)
      } else {
        assert.match(source, /onPoseResult=\{handlePoseResult\}/)
        assert.match(source, /recordPoseDiagnostics\(result,\s*currentPhase\)/)
      }
      assert.doesNotMatch(source, /onPoseResult=\{\(\)=>\{\}\}/)
    }
  })

  it('advances a directed assessment after a successful synthetic continuation', () => {
    const source = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    assert.match(source, /useRouter/)
    assert.match(source, /nextAssessmentScenario/)
    assert.match(source, /router\.push/)
    assert.match(source, /await forceContinue\(currentPhase\)/)
  })

  it('passes the parsed test scenario into a runner-owned current phase', () => {
    const page = readFileSync('app/internal/test-lab/run/page.tsx', 'utf8')
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')

    assert.match(page, /const scenario\s*=\s*parseTestScenario/)
    assert.match(page, /<DirectedExerciseRunner movement=\{movement\} scenario=\{parsedScenario\}/)
    assert.match(runner, /scenario:\s*TestScenario/)
    assert.match(runner, /useDirectedAttempt\(movement,\s*attemptPhase\)/)
    assert.match(runner, /const attemptPhase = scenario\.phase === 'full-run' \? 'full-run' : currentPhase/)
    assert.match(runner, /phase=\{currentPhase\}/)
    assert.doesNotMatch(runner, /useDirectedAttempt\(movement,\s*'calibrating'\)/)
    assert.doesNotMatch(runner, /phase="calibrating"/)
  })

  it('starts exercise tests as a full run and keeps phase jumps behind advanced controls', () => {
    const form = readFileSync('components/internalTesting/TestLabForm.tsx', 'utf8')
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(form, /useState<TestScenarioPhase>\('full-run'\)/)
    assert.match(form, /Start full test/)
    assert.match(form, /Advanced jump/)
    assert.doesNotMatch(form, />Phase</)
    assert.match(runner, /scenario\.phase === 'full-run'/)
    assert.match(runner, /'camera'/)
    assert.match(runner, /setCurrentPhase\('calibrating'\)/)
    assert.match(runner, /setCurrentPhase\('exercising'\)/)
    assert.match(runner, /phase=\{currentPhase\}/)
    assert.match(panel, /currentPhase/)
    assert.doesNotMatch(panel, /scenario\.phase === 'exercising'/)
  })

  it('gates full-run tests through camera, calibration, then count', () => {
    const assessmentRunner = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    const exerciseRunner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(assessmentRunner, /initialAssessmentPhase[\s\S]*?'camera'/)
    assert.match(exerciseRunner, /initialExercisePhase[\s\S]*?'camera'/)
    assert.match(assessmentRunner, /action === 'camera-pass'[\s\S]*?setCurrentPhase\('calibrating'\)/)
    assert.match(exerciseRunner, /action === 'camera-pass'[\s\S]*?setCurrentPhase\('calibrating'\)/)
    assert.match(assessmentRunner, /action === 'calibration-pass'[\s\S]*?setCurrentPhase\('capture'\)/)
    assert.match(exerciseRunner, /action === 'calibration-pass'[\s\S]*?setCurrentPhase\('exercising'\)/)
    assert.match(panel, /CAMERA_TIMEOUT_MS = 30_000/)
    assert.match(panel, /CALIBRATION_TIMEOUT_MS = 30_000/)
    assert.match(panel, /COUNT_ZERO_TIMEOUT_MS = 60_000/)
    assert.match(panel, /Please log a camera issue/)
    assert.match(panel, /Please log a calibration issue/)
    assert.match(panel, /Please log a count issue/)
  })

  it('voices human-confirmation prompts when each Test Lab gate becomes ready', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /Camera passed\. Please tap Log camera passed\./)
    assert.match(panel, /Calibration passed\. Please tap Log calibration passed\./)
    assert.match(panel, /Count is ready\. Please tap Log count passed\./)
    assert.match(panel, /Camera has not passed\. Please log a camera issue\./)
    assert.match(panel, /Calibration has not passed\. Please log a calibration issue\./)
    assert.match(panel, /AI count is still zero\. Please log a count issue\./)
  })

  it('advances to the next movement after the final count pass is recorded', () => {
    const assessmentRunner = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    const exerciseRunner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')

    assert.match(assessmentRunner, /action === 'count-pass'[\s\S]*?router\.push\(nextAssessmentUrl\(\)\)/)
    assert.match(exerciseRunner, /action === 'count-pass'[\s\S]*?router\.push\(nextExerciseUrl\(\)\)/)
  })

  it('does not block full-run phase advancement on quick-action persistence', () => {
    for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')

      assert.match(source, /const persistence = recordQuickAction\(action,\s*currentPhase,\s*evidence\)/)
      assert.match(source, /advanceFullRun\(action\)[\s\S]*?await persistence/)
      assert.doesNotMatch(source, /await recordQuickAction\(action,\s*currentPhase,\s*evidence\)[\s\S]*?advanceFullRun\(action\)/)
    }
  })

  it('keeps camera pass recordable after the tester walks back to tap controls', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /function attemptHadCameraReady\(\)/)
    assert.match(panel, /canRecordCameraFromAttempt = currentPhase === 'camera' && \(mission\.canLogCameraSuccess \|\| attemptHadCameraReady\(\)\)/)
    assert.doesNotMatch(panel, /canRecordCameraFromAttempt = currentPhase === 'camera' && mission\.canLogCameraSuccess/)
  })

  it('does not treat high confidence without landmarks as camera-ready guidance', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /pose\.visibleLandmarks === 0 && pose\.trackedLandmarks === 0/)
    assert.match(panel, /We need body landmarks, not just confidence/)
    assert.match(panel, /0 body landmarks/)
    assert.match(panel, /Best landmarks this attempt/)
    assert.match(panel, /confidence signal/)
    assert.doesNotMatch(panel, /return 'Hold still with your whole body in frame\.'/)
  })

  it('uses the active production tracking requirement for missing body parts', () => {
    const assessmentRunner = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    const exerciseRunner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')

    for (const source of [assessmentRunner, exerciseRunner]) {
      assert.match(source, /trackingLandmarks=\{trackingProfile\.landmarks\}/)
      assert.match(source, /trackingMinVisibility=\{trackingProfile\.minVisibility\}/)
      assert.match(source, /poseSnapshotFromResult\(result,\s*\{[\s\S]*?landmarks: trackingProfile\.landmarks,[\s\S]*?minVisibility: trackingProfile\.minVisibility,[\s\S]*?\}\)/)
    }
    assert.match(assessmentRunner, /getExerciseTrackingProfile\(movement\.exerciseName, false\)/)
    assert.match(assessmentRunner, /framingRequirement=\{movement\.postureFamily === 'seated' \? 'seated-torso' : 'full-body'\}/)
  })

  it('shows and voices specific missing regions without changing pass readiness', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /pose\.missingBodyParts\.slice\(0, 3\)/)
    assert.match(panel, /Keypoints needed:/)
    assert.match(panel, /function cameraGuidanceText[\s\S]*?specificMissingBodyPartCue\(pose\)/)
    assert.match(panel, /function calibrationGuidanceText[\s\S]*?specificMissingBodyPartCue\(pose\)/)
    assert.match(panel, /missingBodyParts: pose\?\.missingBodyParts\.join\(', '\) \|\| null/)
    assert.match(panel, /canRecordCameraFromAttempt = currentPhase === 'camera' && \(mission\.canLogCameraSuccess \|\| attemptHadCameraReady\(\)\)/)
  })

  it('renders a mission board with exercise phase feedback and quick internal annotations', () => {
    const runner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const hook = readFileSync('components/internalTesting/useDirectedAttempt.ts', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')
    const mission = readFileSync('lib/internalTesting/exerciseMission.ts', 'utf8')

    assert.match(runner, /ExerciseMissionPanel/)
    assert.match(runner, /onQuickAction=\{handleQuickAction\}/)
    assert.match(runner, /onCountObserved=\{\(count,\s*evidence\)\s*=>\s*recordCountObservation\(count,\s*currentPhase,\s*evidence\)\}/)
    assert.match(hook, /recordQuickAction/)
    assert.match(hook, /recordCountObservation/)
    assert.match(hook, /missionEventForQuickAction\('count-observed'/)
    assert.match(mission, /productionEvidence:\s*false/)
    assert.match(panel, /currentPhase === 'exercising' &&/)
  })

  it('uses unified Camera Calibration Count standards across assessment and exercise runs', () => {
    const page = readFileSync('app/internal/test-lab/run/page.tsx', 'utf8')
    const assessmentRunner = readFileSync('components/internalTesting/DirectedAssessmentRunner.tsx', 'utf8')
    const exerciseRunner = readFileSync('components/internalTesting/DirectedExerciseRunner.tsx', 'utf8')
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')
    const hook = readFileSync('components/internalTesting/useDirectedAttempt.ts', 'utf8')

    assert.match(page, /<DirectedAssessmentRunner movement=\{movement\} scenario=\{parsedScenario\}/)
    assert.match(assessmentRunner, /ExerciseMissionPanel/)
    assert.match(assessmentRunner, /currentPhase/)
    assert.match(exerciseRunner, /const attemptPhase = scenario\.phase === 'full-run' \? 'full-run' : currentPhase/)
    assert.match(exerciseRunner, /useDirectedAttempt\(movement,\s*attemptPhase\)/)
    assert.match(panel, /Camera/)
    assert.match(panel, /Calibration/)
    assert.match(panel, /Count/)
    assert.match(panel, /Log camera passed/)
    assert.match(panel, /Log calibration passed/)
    assert.match(panel, /Log count passed/)
    assert.match(panel, /AI \$\{counter\.repCount\}\/\$\{scenario\.repeats\}/)
    assert.match(panel, /AI count stuck at 0/)
    assert.match(hook, /recordAiCounterEvent/)
    assert.match(panel, /aiRepPhase/)
    assert.match(exerciseRunner, /engageThreshold/)
    assert.match(exerciseRunner, /returnThreshold/)
  })

  it('makes pass/fail recording and voice feedback explicit for each Test Lab standard', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /createVoiceCoach/)
    assert.match(panel, /voiceCoachRef\.current\.unlock/)
    assert.match(panel, /voiceCoachRef\.current\.speak/)
    assert.match(panel, /Log camera failed/)
    assert.match(panel, /Log calibration failed/)
    assert.match(panel, /Log count failed/)
    assert.match(panel, /Recommended record/)
    assert.match(panel, /Body not detected/)
    assert.match(panel, /If detection appeared and then dropped/)
    assert.match(panel, /Log Tracking flicker only if it dropped during the movement/)
    assert.match(panel, /canRecordCameraFromAttempt/)
    assert.match(panel, /canRecordCalibrationFromAttempt/)
    assert.match(panel, /Best landmarks this attempt/)
    assert.match(panel, /Last signal/)
    assert.match(panel, /attemptBestVisibleLandmarks/)
    assert.match(panel, /disabled:bg-white\/\[0\.12\]/)
    assert.match(panel, /disabled:text-white\/35/)
  })

  it('keeps the test lab mission board compact on phones and portrait tablets', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')
    const overlay = readFileSync('components/internalTesting/InternalTestOverlay.tsx', 'utf8')

    assert.match(panel, /Mobile mission summary/)
    assert.match(panel, /lg:hidden/)
    assert.match(panel, /lg:block/)
    assert.doesNotMatch(panel, /md:hidden|md:block/)
    assert.match(panel, /bottom-3/)
    assert.match(panel, /max-h-\[42dvh\]/)
    assert.match(panel, /Show controls/)
    assert.match(panel, /Hide controls/)
    assert.match(overlay, /useState\(false\)/)
    assert.match(overlay, /top-3/)
    assert.match(overlay, /lg:bottom-3/)
    assert.match(overlay, /lg:top-auto/)
    assert.doesNotMatch(overlay, /sm:bottom-3|sm:top-auto/)
  })

  it('keeps desktop mission controls scrollable and labels confidence separately from camera pass', () => {
    const panel = readFileSync('components/internalTesting/ExerciseMissionPanel.tsx', 'utf8')

    assert.match(panel, /max-h-\[calc\(100dvh-1\.5rem\)\]/)
    assert.match(panel, /overflow-y-auto/)
    assert.match(panel, /confidence signal/)
    assert.match(panel, /High confidence alone is not a camera pass/)
    assert.doesNotMatch(panel, /best body/)
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
    assert.match(runner, /recordAiCounterEvent/)
    assert.match(runner, /onEvent: recordAiCounterEvent/)
    assert.match(panel, /AI count/)
    assert.match(panel, /counter\.status\.chip/)
    assert.doesNotMatch(runner, /normalizedPoseDistance|repBaselineRef|repCooldownRef/)
  })

  for (const name of ['DirectedAssessmentRunner.tsx', 'DirectedExerciseRunner.tsx']) {
    it(`${name} persists report and force-continue actions`, () => {
      const source = readFileSync(`components/internalTesting/${name}`, 'utf8')
      assert.match(source, /useDirectedAttempt/)
      assert.match(source, /onRecord=\{recordIssue\}/)
      assert.match(source, name === 'DirectedAssessmentRunner.tsx'
        ? /onForceContinue=\{continueToNextMovement\}/
        : /onForceContinue=\{continueToNextMovement\}/)
      assert.doesNotMatch(source, /onRecord=\{\(\)=>\{\}\}/)
      assert.doesNotMatch(source, /onForceContinue=\{\(\)=>\{\}\}/)
    })
  }
})
