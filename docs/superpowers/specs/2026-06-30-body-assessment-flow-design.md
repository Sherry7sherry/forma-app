# Forma Body Assessment Flow Design

## Decision

Forma will add a dedicated, approximately two-minute movement assessment for the personal Body Mirror. A missing reliable baseline produces a prominent assessment prompt but does not block a user from starting a normal session. A current stop signal remains a hard safety block because it comes from the unified Body Mirror result, not from route-specific UI logic.

## Product boundary

This work completes the missing pre-training assessment path already implied by Home and the evidence schema. It does not add medical diagnosis, a universal body score, a training-after summary, or new progress calculations.

The assessment contains:

1. A comfort and safety check.
2. Side-view arm raise.
3. Side-view Standing Roll Down.
4. Front-view seated trunk rotation.
5. A concise completion result that returns to Home.

The first reliable assessment is a `baseline`. A later refresh is a `reassessment`. Camera refusal or failure enters a self-report fallback. Low-confidence and partial attempts remain evidence but do not update the Body Mirror.

## Approaches considered

### Dedicated assessment route — selected

A full-screen `/assessment` flow owns setup, camera capture, fallback, persistence, and completion. Home links to it, while Session only consumes the unified Body Mirror decision.

This keeps assessment complexity out of `SessionPlayer`, supports a focused two-minute flow, and gives camera and persistence failures a clear recovery path.

### Home modal wizard — rejected

A modal would preserve location but would become too deep for three camera movements, device orientation guidance, permission recovery, and partial saving. It would also compete with the existing 15-second check-in sheet.

### Assessment embedded in SessionPlayer — rejected

This would reuse some visual machinery but couple baseline evidence to a specific workout. It would make assessment completion, session completion, and partial-session rules difficult to distinguish and would further enlarge an already complex player.

## Architecture

### Assessment domain module

`lib/bodyAssessment` is the seam between raw pose samples and Body Mirror evidence. Its public interface accepts timestamped MediaPipe landmarks for one configured movement and returns either confidence-qualified observations or an explicit non-applying outcome.

It owns:

- stable metric keys, units, better-direction rules, and change thresholds;
- movement-specific sampling windows;
- confidence aggregation;
- baseline versus reassessment selection;
- persistence payload construction;
- partial, camera-unavailable, and low-confidence outcomes.

Home, Progress, and Session never inspect landmarks or calculate movement state.

### Assessment route

`app/assessment/page.tsx` authenticates the user, loads the unified Body Mirror result, and determines whether the new attempt is `baseline` or `reassessment`. It renders a client flow without the normal bottom navigation, matching the existing full-screen Session treatment.

The client flow creates an assessment record before camera capture and saves observations after each completed movement. The attempt starts in a non-applying state and becomes `completed` only after all three movements pass coverage and confidence rules. Exiting after progress marks it `partial` with a completion timestamp so the evidence is retained and ordered correctly.

### Camera adapter

`PoseCamera` remains the MediaPipe adapter. Its interface gains a narrow status callback so assessment can distinguish ready, permission-denied/unavailable, and retry states. Existing Session behavior remains unchanged when the callback is omitted.

Assessment consumes the existing pose-result callback but owns its own movement sampling logic. It does not reuse Session rep counting or form score.

### Unified policy consumption

The Body Mirror module remains the only module that decides:

- whether a reliable baseline exists;
- whether evidence is stale;
- whether a safety hold applies;
- what Home recommends;
- whether Session must block or merely prompt.

A small Session policy derived from `BodyMirrorResult` has three outcomes:

- `allow`: body evidence permits the session;
- `prompt_assessment`: no reliable baseline, but the user can choose **Assess first** or **Continue without assessment**;
- `block_safety`: a current stop signal prevents starting the session and returns the user to Home guidance.

Session does not reimplement the safety-signal list or freshness rules.

## Data flow

1. Home receives recommendation mode `baseline` or `reassess` from `deriveBodyMirror`.
2. The primary Home action links to `/assessment`; the 15-second daily check-in stays a separate action.
3. Assessment records comfort and safety evidence using context `baseline` for the first attempt or `pre_session` for later attempts.
4. If a stop signal is selected, the check-in is saved and camera movement capture does not begin.
5. A camera attempt creates `movement_assessments` evidence and incrementally stores `movement_observations`.
6. Only a completed attempt with all three movements and confidence at or above `0.70` can update mobility or movement control.
7. Returning to Home reloads the same evidence and derives a new Today’s Body result.
8. Progress automatically reflects that result through the existing shared module.
9. Session reads the same result and applies allow, soft prompt, or safety block behavior.

## Movement evidence

Metric names and units are durable comparison contracts. Baseline and reassessment must emit the same keys.

- Side arm raise:
  - mobility: maximum arm elevation angle, degrees, higher is better;
  - control: torso-drift ratio during the raise, ratio, lower is better.
- Standing Roll Down:
  - mobility: normalized wrist descent relative to torso scale, ratio, higher is better;
  - control: lateral torso-drift ratio, ratio, lower is better.
- Seated trunk rotation:
  - mobility: normalized shoulder-line rotation range, ratio, higher is better;
  - control: pelvis-drift ratio, ratio, lower is better.

Each metric is derived from a short series rather than a single frame. The module rejects missing landmarks, insufficient range, incorrect framing, and low visibility instead of manufacturing a score.

## Self-report fallback

If camera permission is denied or MediaPipe cannot start, the attempt is retained with `capture_mode = self_report` and `status = camera_unavailable`. The user can report whether each movement felt easy, limited, or uncomfortable, but self-report does not create numeric movement observations and therefore cannot establish or refresh mobility/control baselines.

The fallback can still update comfort and safety evidence. Home explains that the movement mirror needs a clearer camera read while allowing normal sessions unless a safety signal is present.

## Error and exit behavior

- Database creation failure: stay on the current step and offer retry; do not pretend an attempt exists.
- Observation save failure: keep captured samples in memory, show retry, and do not advance.
- Camera denial/failure: offer retry or self-report fallback.
- Low confidence: retain the attempt as `low_confidence`, explain that the mirror was not updated, and offer retry.
- User exits after starting: mark the assessment `partial`; never count it as a completed training session.
- User exits before an assessment row exists: return Home with no new evidence.
- Safety signal: save it, stop the assessment, and show non-diagnostic stop guidance.

## User interface

The flow extends Forma’s existing cream, sage, serif display type, rounded cards, and camera-first Session language.

- Intro: purpose, two-minute estimate, three movements, no mat, and non-diagnostic note.
- Comfort/safety: reuse the current check-in controls without nesting a modal.
- Movement setup: movement name, side/front camera placement, one concise instruction, progress `1 of 3`.
- Capture: camera dominates the screen; one framing status and one action cue are visible.
- Completion: confirms whether the mirror was updated, not a medical or universal score.

Home changes the incorrect baseline action label from **Add how you feel now** to **Start 2-minute assessment**. The daily check-in card remains available separately.

## Testing

- Pure metric tests for all three movements, including translation normalization, missing landmarks, insufficient range, and stable metric keys.
- Confidence tests at, above, and below `0.70`.
- Persistence payload tests for baseline, reassessment, completed, partial, camera-unavailable, and low-confidence attempts.
- Body Mirror tests proving partial and low-confidence attempts do not update dimensions.
- Session-policy tests proving no baseline prompts but allows skipping, while safety signals block.
- Home contract tests proving baseline/reassessment actions link to `/assessment` and daily check-in remains separate.
- Camera interface regression tests proving Session behavior is unchanged when the new status callback is absent.
- Browser checks for camera-ready, denied, low-confidence, partial-exit, successful baseline, and Session soft-prompt states.

## Out of scope

- Training-after summary UI.
- Writing `body_feel_after` from Session.
- Medical interpretation or diagnosis.
- A body-wide numeric score.
- New progress charts.
- Making assessment a subscription-only feature.
