# Test Lab Specific Landmark Guidance Design

## Goal

Replace generic Test Lab camera and calibration messages such as “get full body in frame” with stable, actionable guidance that identifies the body region whose required pose landmarks are not visible. The change applies to both assessment and exercise runs.

## Source of truth

The Test Lab must continue using the production movement tracking profile for its required landmark indices and minimum visibility threshold. It must not define a second camera-readiness or movement-recognition engine.

Each pose result already contains MediaPipe landmark visibility values. The directed runner will pass the active production tracking requirement into the existing Test Lab snapshot adapter. The adapter will retain only diagnostic labels for missing regions; it will not change the production pose result or readiness calculation.

## Landmark labels

Required landmark indices are translated into tester-friendly regions:

- nose → head;
- shoulders → left shoulder, right shoulder, or both shoulders;
- elbows → left elbow, right elbow, or both elbows;
- wrists → left wrist, right wrist, or both wrists;
- hips → left hip, right hip, or both hips;
- knees → left knee, right knee, or both knees;
- ankles → left ankle, right ankle, or both ankles.

When both sides of a paired region are below the production visibility threshold, the UI uses the shorter “both” label. When only one side is below the threshold, it names that side. Unknown profile indices fall back to a neutral “required keypoint” label instead of crashing or inventing anatomy.

## Tester experience

While Camera or Calibration has not passed:

- the mission panel shows the current missing regions in priority order;
- the existing voice coach names at most the first three missing regions, then gives the appropriate placement or calibration instruction;
- generic no-body guidance remains available when no useful pose landmarks are present;
- a passing pose produces the existing manual-confirmation prompt and does not show a stale missing-region warning.

The priority order is head, shoulders, hips, knees, ankles, elbows, then wrists. This makes camera-placement problems actionable before fine distal-point instability. Voice output remains throttled by the existing coach cooldown so visibility flicker cannot create a stream of speech.

## Data flow and evidence

The active directed runner supplies the same landmark list and minimum-visibility threshold that it supplies to `PoseCamera`. `poseSnapshotFromResult` compares required indices with the current pose result, groups missing points into labels, and exposes those labels to `ExerciseMissionPanel`.

When a tester records a pass or failure, the current missing-region labels are stored as a comma-separated diagnostic field in the existing synthetic internal event evidence. They must remain isolated from production observations, reports, session history, progress, recommendations, summaries, entitlements, and analytics.

Raw landmark coordinates are not added to UI state by this change. Replay, golden-sample playback, and built-in video capture remain out of scope.

## Failure handling

- Missing or empty landmark arrays yield safe no-body guidance.
- A missing visibility value counts as not visible.
- An empty tracking profile keeps the generic guidance and never marks confidence alone as a pass.
- The specific label is explanatory only; camera and calibration pass buttons remain controlled by the existing readiness state.

## Verification

Automated tests will cover bilateral grouping, single-side labeling, threshold boundaries, missing landmark data, runner use of the active production tracking profile, visible and spoken specific guidance, and internal-only diagnostic evidence. Completion also requires the focused tests, full `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
