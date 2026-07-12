# Internal Movement Test Platform Design

## Goal

Reduce the human back-and-forth required to test Forma's camera, pose tracking, repetition counting, movement feedback, and end-to-end flows across MacBook, iPad, and phone devices.

The first release must ensure that a blocker in any of the three initial assessment movements or 30-plus training exercises does not prevent internal testers from covering the rest of the flow. Each reported problem must include enough synchronized diagnostic evidence for a developer to investigate without immediately asking the tester to repeat the movement.

## Current problem

Two internal testers currently run complete training flows and report problems with screen recordings. A failure in camera access, framing, calibration, tracking, counting, feedback, persistence, or navigation can stop the flow, leaving later movements untested. Screen recordings show the visible symptom but not the pose landmarks, confidence, tracking state, thresholds, or internal transition that caused it.

Complete-flow testing and isolated movement diagnosis are different jobs and need separate paths. Complete-flow testing validates that a user can reach the final assessment result or session summary. Directed testing validates one assessment movement, exercise, phase, device condition, or known failure repeatedly.

## Approved approach

Forma will provide two protected internal testing paths that share the production movement engine:

1. **Complete-flow test mode** preserves the real assessment or training journey and adds controls to record a problem, retry the current phase, or record the blocker and continue with a controlled synthetic result.
2. **Directed test lab** starts any registered assessment movement or training exercise at a selected phase without requiring testers to repeat unrelated prerequisite screens.

Both paths create structured test runs and attempts. They reuse production tracking profiles and state transitions rather than implementing a second movement engine.

## Testable movement registry

A single registry will expose all testable camera movements. It covers every training exercise and the three initial assessment movements: Arm Arcs, Standing Roll Down, and Spine Twist.

The registry extends existing production definitions instead of duplicating them. Each entry contains:

- stable identifier and display name;
- kind: assessment or training exercise;
- posture family: standing, seated, supine, side-lying, prone, quadruped, or full-body;
- tracking mode: automatic count, manual count, or timed;
- required camera orientation;
- supported capabilities: calibration, repetition counting, form feedback, or assessment observation;
- applicable test scenarios and assertion type.

Existing `exerciseTracking` profiles remain the source of truth for landmarks, visibility, confidence, engage and return thresholds, grace periods, and camera orientation. Registry contract tests fail when a production movement is missing from the registry or has an invalid or contradictory test definition.

## Complete-flow test mode

An authorized internal tester can enable test mode for the normal assessment and session routes. A collapsible overlay shows:

- build, commit, and tracking-profile version;
- device, browser, viewport, and orientation;
- current movement and phase;
- camera lifecycle, framing, and calibration state;
- landmark coverage and confidence;
- current repetition state and count;
- the latest movement-feedback cue.

The overlay offers four actions:

- record a problem;
- retry the current phase;
- record the problem and force the flow to continue;
- end the test run.

Forcing continuation injects the smallest legal result for the current phase. Supported recovery includes a camera-unavailable result, calibration success, entry into the exercising phase, a tester-supplied repetition count, completion of the current movement, or a local pending-save result. Every injection records its reason and before/after state.

Synthetic results are test evidence only. They must never enter real movement observations, assessment reports, session history, progress, recommendations, entitlement calculations, or product analytics.

## Directed test lab

The protected `/internal/test-lab` route lets a tester select:

- assessment or training exercise;
- a specific registered movement;
- starting phase;
- normal operation or a predefined failure scenario;
- number of repetitions of the test attempt.

It generates a stable, copyable test URL so another tester can open the same scenario on an iPad or phone. A tester must be able to restart any movement or assessment in under 30 seconds without completing onboarding, earlier assessment movements, or earlier exercises.

The lab does not maintain hand-written movement logic. It uses the registry to render available phases and scenarios, then runs the same camera and movement components used by production flows.

## Test runs and attempts

Opening a complete flow or directed scenario creates a test run. Each assessment movement or exercise execution creates an attempt. A complete run can therefore contain passed, failed, blocked, retried, skipped, and pending-upload attempts without losing the overall journey.

Each attempt records:

- run, tester, start time, and end time;
- build, commit, and tracking-profile version;
- flow, movement, posture family, and phase;
- device, operating system, browser, viewport, and orientation;
- camera resolution, frame rate, and facing mode when available;
- landmark coordinates, visibility, and body confidence;
- framing, orientation, calibration, repetition, and feedback events;
- blockers, retries, synthetic transitions, errors, and persistence failures;
- structured tester classification and optional note;
- references to diagnostic artifacts and the external screen recording.

High-frequency landmark data is buffered in the browser and exported as a compressed artifact at the end of an attempt. Database rows contain summaries and artifact references rather than one row per frame.

## Problem-reporting flow

Problem reporting uses short structured choices:

- unable to continue;
- missed repetitions;
- extra repetitions;
- incorrect feedback;
- expected feedback was absent;
- camera or framing problem;
- display problem;
- performance, heat, or battery problem;
- other.

The form asks only follow-up fields relevant to the selected type. A count error asks for the actual and displayed counts. A feedback error asks which cue was wrong and whether its content or timing was wrong. Free text is optional.

On submission, the tester sees an attempt identifier, captured device and movement, artifact status, and actions to retry, force continuation, copy the problem reference, or end the run. The attempt identifier and timestamp allow the existing screen recording to be aligned with diagnostic events.

## Storage, upload, and privacy

Test data is isolated from production business data in dedicated tables or an internal schema:

- `internal_test_runs`;
- `internal_test_attempts`;
- `internal_test_events`;
- `internal_test_artifacts`.

The initial release captures structured diagnostics and landmarks but does not automatically capture or upload body video. Testers continue using screen recording and associate it with the attempt identifier. Built-in circular video capture is deferred until the diagnostic format is proven stable.

If upload fails, the browser keeps the artifact in IndexedDB, marks it pending, retries when connectivity returns, and offers manual JSON or compressed-file export. Artifact failure must never prevent the test flow from continuing.

## Authorization

Test mode and all internal routes require a server-verified internal account or environment-specific email allowlist. URL parameters alone do not grant access. Production users must not see test controls or be able to inject synthetic results.

The server independently rejects internal-test writes from unauthorized users. Leaving test mode clears all synthetic client state.

## Developer review and replay

The first developer view lists runs and attempts and filters them by status, movement, posture family, device, browser, issue type, and build. An attempt view initially shows the state/event timeline, diagnostics summary, tester annotation, and raw artifact download.

A later replay phase adds synchronized landmark playback, skeleton overlay, threshold graphs, and screen-recording or built-in video playback. At any replay time, a developer can inspect framing, orientation, landmark visibility, normalized pose distance, engage and return thresholds, repetition state, and feedback triggers.

An attempt can be classified as diagnostic only, unreliable, or a golden regression sample. Promoting it to the regression set requires explicit expected outcomes, such as calibration deadline, expected count, forbidden feedback, required feedback, maximum tracking-loss duration, or expected assessment-confidence path.

## Automated coverage strategy

### Registry contract coverage

Every assessment movement and training exercise receives automated checks for:

- valid posture family and camera orientation;
- valid landmark indices and thresholds;
- engage threshold greater than return threshold;
- correct automatic, manual, or timed behavior;
- reachable execution state;
- recovery from temporary tracking loss;
- a completion or safe-exit path;
- separation of assessment and exercise assertion rules.

### Posture-family device coverage

Human device testing is organized around standing, seated, supine, side-lying, prone, quadruped, and full-body risk families. Each build runs one or two representative movements from each affected family across the required devices. A specific movement receives directed device testing whenever a change affects it or historical evidence shows elevated failure risk.

### Golden samples

Over time, each movement should gain at least one successful sample, one framing or confidence boundary sample, and one recognition or feedback failure sample. This collection grows from real testing; the first release does not block on recording every sample for every movement.

The three initial assessment movements receive priority because failure occurs before the core product experience and because their observation, confidence, degradation, and report-evidence rules differ from training repetition rules.

## Assessment-specific assertions

Assessment tests verify:

- Arm Arcs, Standing Roll Down, and Spine Twist remain reachable in order;
- movement constraints skip only the appropriate assessment movements;
- reliable observations meet the configured confidence threshold;
- low-confidence and camera-unavailable paths degrade safely;
- partial or failed persistence does not silently lose the whole assessment;
- reports use only reliable, non-synthetic assessment evidence;
- a blocker in one assessment does not prevent test coverage of the remaining assessment flow.

## Training-specific assertions

Training tests verify:

- calibration and execution transitions;
- correct automatic, manual, or timed behavior;
- correct repetition count where applicable;
- appropriate movement feedback and timing;
- tracking-loss recovery;
- persistence and transition to the next exercise;
- reachability of the final session summary despite recorded test blockers.

## Internal testing rhythm

For each testable build:

- Tester A runs one complete flow on MacBook and one on iPad, recording blockers and continuing through the final result or summary.
- Tester B runs directed tests on a phone or other affected device for the movements and posture families changed by the build, normally repeating each target scenario three times.
- Developers run registry contracts and accumulated golden samples before requesting another human test.
- Human confirmation after a fix is limited to the affected device, movement, and real-camera behavior.

Test requests use stable scenario links and state explicit device, build, movement, repetition count, and pass criteria. Testers are not asked simply to test the app again.

## Delivery phases

The MVP comprises Phases 1 through 3. Phases 4 and 5 are follow-on investments that depend on stable diagnostic artifacts collected through real internal use.

### Phase 1: unblock complete flows

- server-protected test mode;
- assessment and training overlays;
- retry and controlled continuation;
- synthetic-data isolation;
- test event recording.

Exit criterion: failure in any assessment or exercise no longer prevents an internal tester from reaching the final assessment result or session summary.

### Phase 2: directed testing

- unified registry and contract tests;
- test-lab route;
- movement and phase selection;
- stable scenario URLs;
- rapid repeated attempts.

Exit criterion: any registered assessment or exercise can be restarted in under 30 seconds.

### Phase 3: diagnostic packages

- build and environment capture;
- landmark and event buffering;
- structured problem annotation;
- IndexedDB retry and manual export;
- basic run and attempt views.

Exit criterion: a developer can identify the failing movement, phase, device context, and internal state without first asking the tester to reproduce it.

### Phase 4: replay and regression

- synchronized event and landmark replay;
- golden-sample promotion;
- deterministic movement-logic replay;
- batch regression reporting.

Exit criterion: historical failures are evaluated before a human is asked to confirm a fix.

### Phase 5: built-in problem video

- circular video buffer;
- synchronized video and diagnostic timeline;
- tester preview and consent;
- automatic retention cleanup;
- skeleton overlay during replay.

This phase begins only after the diagnostic package schema proves stable in internal use.

## MVP acceptance scenarios

- A blocked Arm Arcs attempt can be recorded and the tester can continue to Standing Roll Down.
- A low-confidence assessment follows the intended degradation path.
- A synthetic assessment observation never appears in an assessment report.
- Calibration failure in any registered exercise can be recorded and bypassed in test mode.
- A tester can supply the actual repetition count after an automatic-count failure and continue.
- An attempt upload or save failure does not block subsequent movements.
- The tester can reach the final assessment result and training summary after one or more recorded blockers.
- Unauthorized users cannot see internal controls or submit test artifacts.
- Internal attempts do not change user progress, recommendations, assessment evidence, or product analytics.

## Success measures

- Nearly zero complete internal test runs terminate early because of a movement blocker.
- Any assessment movement or training exercise can begin a directed retest within 30 seconds.
- Every reported problem includes an attempt identifier, build, device context, and state timeline.
- A problem normally requires one human capture and at most one targeted real-device confirmation after the fix.
- All current assessment movements and training exercises exist in the registry and pass baseline contract tests.
- Test artifact upload success and pending-export visibility are measurable.

## Out of scope for the initial release

- capturing or uploading full training videos by default;
- a complex tester-role or task-assignment system;
- automatic source-code impact analysis;
- immediate golden-sample coverage for every movement;
- complete cross-browser camera emulation;
- redesigning pose-detection or movement-recognition algorithms;
- a second copy of production movement configuration;
- allowing synthetic data into production analysis or user history.
