# Internal Movement Test Platform Implementation Plan

> Design source: `docs/superpowers/specs/2026-07-12-internal-movement-test-platform-design.md`

## Objective

Deliver the MVP defined in the approved design: protected complete-flow test controls, a configuration-driven directed test lab, structured diagnostic packages, offline-safe upload/export, and basic run/attempt review. Keep synthetic test evidence isolated from assessment reports, session history, progress, recommendations, and product analytics.

This plan covers Delivery Phases 1–3. Landmark/video replay, golden-sample playback, and built-in circular video capture remain follow-on work.

## Implementation principles

- Use the production assessment and exercise engines; do not create a second pose or repetition engine.
- Keep test authorization server-verified. Query parameters select a scenario but never grant access.
- Route every forced transition through typed assessment/session adapters, not scattered `testMode` conditionals.
- Store internal evidence in dedicated tables and storage paths protected by RLS.
- Extract reusable pure logic from `SessionPlayer` before connecting the test UI so it can be tested without rendering the full player.
- Add tests before each behavior change and run focused tests after every task.
- Commit each numbered task independently unless two adjacent tasks cannot compile separately.

## Task 1: Establish internal-test domain types and the movement registry

**Files**

- Create `lib/internalTesting/types.ts`
- Create `lib/internalTesting/movementRegistry.ts`
- Create `lib/internalTesting/movementRegistry.test.ts`
- Modify `lib/exerciseTracking.ts`
- Modify `components/assessment/MovementAssessmentCapture.tsx`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing registry tests that assert:
   - all names in `FLOOR_EXERCISE_NAMES` and all explicit tracking-profile overrides resolve to a registry entry;
   - Arm Arcs, Standing Roll Down, and Spine Twist exist as assessment entries with their stable movement keys;
   - every entry declares kind, posture family, tracking mode, orientation, capabilities, and scenario identifiers;
   - automatic-count entries have `engageThreshold > returnThreshold`;
   - manual/timed entries cannot advertise automatic-count scenarios;
   - stable identifiers are unique.
2. Export the production exercise-name collection and tracking override names from `lib/exerciseTracking.ts` through read-only helpers so the registry never copies the authoritative tracking configuration.
3. Define `TestableMovement`, `TestCapability`, `TestScenarioDefinition`, `TestMovementKind`, and posture-family types.
4. Move the three assessment movement definitions out of the component into the registry, preserving the current keys, copy, view, constraints, and `exerciseName` values.
5. Update `MovementAssessmentCapture` to read the three assessment entries from the registry.
6. Add the new pure TypeScript files to `tsconfig.test.json`.

**Verification**

```bash
npm test -- --test-name-pattern="movement registry"
npm run lint
```

**Commit**

```text
feat: add internal movement test registry
```

## Task 2: Extract deterministic session tracking events from `SessionPlayer`

**Files**

- Create `lib/internalTesting/trackingEvents.ts`
- Create `lib/internalTesting/trackingEvents.test.ts`
- Modify `app/session/[id]/SessionPlayer.tsx`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing tests for a serializable tracking snapshot and bounded event buffer:
   - calibration blocker events include expected/actual orientation, visibility counts, confidence, and thresholds;
   - pose samples are throttled without dropping phase/count/blocker events;
   - the buffer evicts oldest events at its limit;
   - events include movement ID/name, monotonic elapsed time, wall-clock timestamp, build/profile version, and attempt ID;
   - no raw DOM, MediaStream, function, or Supabase object can enter the payload.
2. Move `DebugEventType`, `DebugLogEntry`, buffer limiting, sample throttling, and JSON serialization into the new pure module.
3. Expand event types to cover `camera_status`, `calibration`, `pose_sample`, `phase_change`, `count`, `feedback`, `blocker`, `retry`, `synthetic_transition`, `persistence_error`, and `attempt_end`.
4. Adapt the existing `poseDebug` path to emit through the shared collector while preserving the current downloadable debug log behavior.
5. Keep the existing on-screen diagnostics unchanged in this task.

**Verification**

```bash
npm test -- --test-name-pattern="tracking event"
npm run lint
```

**Commit**

```text
refactor: extract movement tracking diagnostics
```

## Task 3: Add server-side internal tester authorization

**Files**

- Modify `lib/env.ts`
- Modify `lib/env.test.ts`
- Create `lib/internalTesting/auth.ts`
- Create `lib/internalTesting/auth.test.ts`
- Create `app/internal/layout.tsx`
- Modify `proxy.ts`
- Modify `lib/i18n/publicPages.test.ts`
- Modify `.env.example`
- Modify `README.md`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing tests for parsing `INTERNAL_TESTER_EMAILS` as a normalized, case-insensitive allowlist with whitespace and empty-value handling.
2. Add a server-only `requireInternalTester()` helper that gets the authenticated user and returns a typed internal identity or redirects/throws.
3. Protect every `/internal/*` page in `app/internal/layout.tsx` with the helper.
4. Ensure `proxy.ts` still applies normal authentication, disclaimer, and onboarding gates; do not add `/internal` to `PUBLIC_PATHS`.
5. Add a separate API authorization helper that returns JSON `401`/`403` responses rather than redirects.
6. Test that query parameters such as `testMode=1` never grant authorization.

**Verification**

```bash
npm test -- --test-name-pattern="internal tester|public pages|environment"
npm run lint
```

**Commit**

```text
feat: protect internal movement testing routes
```

## Task 4: Create isolated persistence and RLS policies

**Files**

- Create `supabase/migrations/011_internal_movement_testing.sql`
- Create `lib/internalTesting/persistence.ts`
- Create `lib/internalTesting/persistence.test.ts`
- Modify `types/index.ts`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing persistence contract tests for run, attempt, event-batch, artifact, and completion payloads.
2. Add dedicated tables:
   - `internal_test_runs` with tester, source flow, build/profile versions, environment summary, status, and timestamps;
   - `internal_test_attempts` with run, movement, kind, phase, status, issue classification, synthetic flag, summary, and timestamps;
   - `internal_test_events` with attempt, batch sequence, time range, and compressed-or-JSON event payload;
   - `internal_test_artifacts` with attempt, artifact kind, storage path or inline export metadata, checksum, upload state, and retention timestamp.
3. Add indexes for build, movement, status, device class, browser, issue type, and run/attempt time.
4. Enable RLS and grant no direct authenticated-client access to internal test tables. All reads and writes go through protected server routes after `INTERNAL_TESTER_EMAILS` authorization; those routes use a server-only admin client. This keeps the environment allowlist as the single tester-identity source.
5. Explicitly avoid foreign keys from internal attempts to production `movement_observations`, `movement_assessments`, or `session_records`.
6. Add typed builders and validators in `persistence.ts`; reject unsupported issue types, invalid movement IDs, negative counts, and synthetic production references.
7. Update shared database types used by the app.

**Verification**

```bash
npm test -- --test-name-pattern="internal test persistence"
npm run lint
```

Apply the migration to a disposable/local Supabase environment. Verify both allowlisted and normal browser clients receive RLS errors on direct table access, while the protected API accepts the allowlisted account and rejects the normal account.

**Commit**

```text
feat: add isolated internal test persistence
```

## Task 5: Implement run and attempt API routes

**Files**

- Create `app/api/internal-tests/runs/route.ts`
- Create `app/api/internal-tests/runs/[runId]/attempts/route.ts`
- Create `app/api/internal-tests/attempts/[attemptId]/events/route.ts`
- Create `app/api/internal-tests/attempts/[attemptId]/complete/route.ts`
- Create `lib/internalTesting/api.ts`
- Create `lib/internalTesting/api.test.ts`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing route-contract tests for unauthorized, forbidden, malformed, not-found, duplicate-batch, and successful requests.
2. Implement create-run, create-attempt, append-event-batch, and complete-attempt endpoints using the server authorization helper.
3. Use a server-only Supabase admin client inside these routes; never expose the service-role key or let the browser address internal tables directly.
4. Make event batches idempotent using `(attempt_id, sequence)` uniqueness.
5. Validate movement IDs against the registry and ensure run ownership/authorization before accepting child writes.
6. Accept environment data captured by the browser but derive tester identity on the server.
7. Return stable JSON error codes so IndexedDB retry can distinguish retryable network/server failures from permanent validation failures.

**Verification**

```bash
npm test -- --test-name-pattern="internal test api"
npm run lint
```

**Commit**

```text
feat: add internal test run APIs
```

## Task 6: Build the offline-safe client diagnostic session

**Files**

- Create `lib/internalTesting/clientSession.ts`
- Create `lib/internalTesting/clientSession.test.ts`
- Create `lib/internalTesting/indexedQueue.ts`
- Create `lib/internalTesting/exportPackage.ts`
- Create `components/internalTesting/InternalTestProvider.tsx`
- Modify `app/internal/layout.tsx`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing pure tests for lifecycle transitions: idle → run active → attempt active → pending upload → completed/failed.
2. Write failing tests for retry classification, ordered event batches, duplicate prevention, and resumption after reload.
3. Implement an IndexedDB-backed queue behind a small interface; provide an in-memory adapter for tests.
4. Capture build/commit/profile version, user agent, viewport, orientation, device class, and camera diagnostics at run/attempt boundaries.
5. Flush important events immediately and pose samples in bounded batches. Keep upload failure non-blocking.
6. Implement manual JSON/compressed export with schema version, checksums, run/attempt metadata, and events.
7. Expose provider actions for starting/ending runs and attempts, recording events, reporting upload status, retrying pending batches, and exporting.

**Verification**

```bash
npm test -- --test-name-pattern="diagnostic session|indexed queue|export package"
npm run lint
```

**Commit**

```text
feat: add offline-safe diagnostic sessions
```

## Task 7: Define controlled synthetic transition policies

**Files**

- Create `lib/internalTesting/transitionPolicy.ts`
- Create `lib/internalTesting/transitionPolicy.test.ts`
- Create `lib/internalTesting/controllers.ts`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing table-driven tests for every supported assessment and session phase.
2. Define typed reasons and commands: retry phase, camera unavailable, calibration passed, start exercising, supply actual repetitions, complete movement, and continue with pending persistence.
3. For each command, return either a legal typed transition or a denial with a reason. Disallow unrelated transitions, negative/out-of-range repetition counts, and transitions after an attempt ends.
4. Require every accepted transition to produce a `synthetic_transition` event containing prior state, next state, tester reason, and command payload.
5. Keep the policy pure. React adapters execute approved commands; the policy must not mutate UI or production records.

**Verification**

```bash
npm test -- --test-name-pattern="synthetic transition"
npm run lint
```

**Commit**

```text
feat: define safe internal test transitions
```

## Task 8: Integrate complete-flow controls with the three assessment movements

**Files**

- Create `components/internalTesting/InternalTestOverlay.tsx`
- Create `components/internalTesting/ReportIssueSheet.tsx`
- Create `components/internalTesting/ActualRepCountField.tsx`
- Create `lib/internalTesting/assessmentAdapter.ts`
- Create `lib/internalTesting/assessmentAdapter.test.ts`
- Modify `components/assessment/MovementAssessmentCapture.tsx`
- Modify `app/assessment/BodyAssessmentFlow.tsx`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing adapter tests for retrying setup/capture, marking camera unavailable, recording low confidence, and synthetically completing one assessment movement while continuing to the next.
2. Add an optional internal-test adapter prop to `MovementAssessmentCapture`; production callers omit it and preserve current behavior.
3. Emit camera, framing, calibration, evidence, movement-change, and persistence events into the diagnostic session.
4. Render the overlay only when server-authorized internal test context is present.
5. Implement structured issue categories and relevant follow-up fields.
6. Ensure synthetic completion stores only internal attempt evidence. Do not call `buildObservationInserts` or update a production assessment using synthetic observations.
7. Preserve real observations gathered before/after a synthetic attempt, but exclude the synthetic movement from report evidence.
8. Verify a blocked Arm Arcs attempt can be recorded and coverage continues to Standing Roll Down and Spine Twist.
9. Keep the public guest assessment outside internal test mode; directed and complete-flow internal testing requires an authenticated allowlisted account.

**Verification**

```bash
npm test -- --test-name-pattern="assessment adapter|assessment flow|assessment report"
npm run lint
```

Perform a manual authenticated assessment smoke test with test mode off and confirm no internal UI or internal writes occur.

**Commit**

```text
feat: unblock internal assessment test flows
```

## Task 9: Integrate complete-flow controls with training sessions

**Files**

- Create `lib/internalTesting/sessionAdapter.ts`
- Create `lib/internalTesting/sessionAdapter.test.ts`
- Modify `app/session/[id]/SessionPlayer.tsx`
- Modify `components/internalTesting/InternalTestOverlay.tsx`
- Modify `components/internalTesting/ReportIssueSheet.tsx`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing adapter tests for retry calibration, start exercising, supply corrected repetitions, complete timed/manual/automatic movements, continue after persistence failure, and end the run.
2. Introduce one `InternalSessionTestAdapter` at the `SessionPlayer` boundary. It receives narrow callbacks for existing transitions rather than direct access to component state setters.
3. Reuse the shared diagnostic collector for camera, calibration, repetition, feedback, blocker, retry, persistence, and completion events.
4. Route “force continue” through `transitionPolicy.ts`, then existing `startExercising`, repetition adjustment, and next-exercise functions.
5. Mark a synthetically completed exercise only in the internal attempt. Do not add it to `completedExercises`, `formScores`, saved session exercises, AI coach summaries, or progress as a real completion. Maintain a separate test-only coverage state so the test UI can proceed.
6. Keep current `poseDebug=1` support working; internal test mode may enable richer diagnostics but must not remove standalone debug export.
7. Confirm normal Pro and free-session behavior remains unchanged when test context is absent.

**Verification**

```bash
npm test -- --test-name-pattern="session adapter|exercise tracking|pose tracking|rep feedback"
npm run lint
```

Manually exercise one automatic-count movement, one manual-count movement, and one timed hold in both normal and internal modes.

**Commit**

```text
feat: unblock internal session test flows
```

## Task 10: Build the directed test-lab scenario launcher

**Files**

- Create `app/internal/test-lab/page.tsx`
- Create `app/internal/test-lab/run/page.tsx`
- Create `components/internalTesting/TestLabForm.tsx`
- Create `components/internalTesting/DirectedAssessmentRunner.tsx`
- Create `components/internalTesting/DirectedExerciseRunner.tsx`
- Create `lib/internalTesting/scenarios.ts`
- Create `lib/internalTesting/scenarios.test.ts`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing parser tests for valid/invalid movement IDs, phases, scenarios, repeat counts, and incompatible capability selections.
2. Generate available movement, phase, and scenario options from the registry.
3. Serialize a versioned, stable query string that selects the test but grants no authorization.
4. Directed assessment runs mount the production `PoseCamera` and assessment evidence logic for one registry item.
5. Directed exercise runs mount extracted production calibration/tracking logic for one registry item. If `SessionPlayer` cannot be reused without production persistence, extract a focused `ExerciseTrackingRuntime` component rather than copying its state machine.
6. After an attempt ends, offer repeat, change device/scenario, copy link, export pending package, and end run.
7. Persist the last selected scenario locally for the two internal testers.

**Verification**

```bash
npm test -- --test-name-pattern="internal test scenario"
npm run lint
```

Manually verify on desktop responsive emulation that every registry entry can generate and reopen a stable URL. Then verify at least one standing assessment, supine exercise, side-lying exercise, quadruped exercise, prone exercise, and timed/manual movement on real devices.

**Commit**

```text
feat: add directed movement test lab
```

## Task 11: Add run and attempt review pages

**Files**

- Create `app/internal/test-runs/page.tsx`
- Create `app/internal/test-runs/[runId]/page.tsx`
- Create `app/internal/test-attempts/[attemptId]/page.tsx`
- Create `components/internalTesting/TestRunFilters.tsx`
- Create `components/internalTesting/TestEventTimeline.tsx`
- Create `lib/internalTesting/queries.ts`
- Create `lib/internalTesting/queries.test.ts`
- Modify `tsconfig.test.json`

**Steps**

1. Write failing query tests for authorization, filters, pagination, and tester-safe summaries.
2. Implement filters for status, movement, kind, posture family, device class, browser, issue type, and build.
3. Show attempts grouped under their run, including passed, failed, blocked, retried, skipped, and pending-upload states.
4. Build a basic event timeline with timestamps, phase changes, blockers, counts, feedback, synthetic transitions, and persistence errors.
5. Display metadata, tester annotation, upload state, and raw artifact/export download.
6. Do not implement skeleton/video replay or threshold graphs in this task.

**Verification**

```bash
npm test -- --test-name-pattern="internal test queries"
npm run lint
```

**Commit**

```text
feat: add internal test run review
```

## Task 12: Add end-to-end contract coverage and release checks

**Files**

- Create `lib/internalTesting/flowContracts.test.ts`
- Modify relevant assessment/session source-contract tests
- Modify `tsconfig.test.json`
- Update `README.md` with internal test setup and retention/cleanup operations

**Steps**

1. Add source and pure integration tests covering every MVP acceptance scenario from the design.
2. Assert all registry movements can create attempts and legal start states.
3. Assert synthetic assessment evidence cannot reach report composition or observation inserts.
4. Assert synthetic exercise results cannot reach session history, AI summaries, progress, or analytics payloads.
5. Assert unauthorized users cannot load internal pages or call internal APIs.
6. Assert pending artifacts are visible and exportable after simulated network failure.
7. Document environment configuration, tester onboarding, scenario links, artifact retention, pending-upload recovery, and the production-data isolation rule.

**Full verification**

```bash
npm test
npm run lint
npm run build
git diff --check
```

**Manual device acceptance**

1. MacBook Safari or Chrome: run the complete assessment and one complete training plan; force one assessment and one exercise blocker; reach both final screens.
2. iPad Safari: repeat the complete-flow test and confirm orientation, camera lifecycle, retry, force-continue, and pending-upload behavior.
3. iPhone Safari and one Android Chrome device when available: open a copied directed scenario, repeat it three times, and confirm the same attempt metadata appears in review.
4. Verify all three assessment movements are reachable after an earlier synthetic transition.
5. Verify representative standing, seated, supine, side-lying, prone, quadruped, full-body, manual, automatic, and timed entries can launch.
6. Sign in with a non-allowlisted account and confirm internal pages and APIs are inaccessible.
7. Inspect production assessment, observation, session, progress, and analytics records and confirm synthetic attempts created none.

**Commit**

```text
test: verify internal movement testing MVP
```

## Recommended execution checkpoints

- **Checkpoint A — after Task 4:** review registry, authorization, schema, and RLS before any UI integration.
- **Checkpoint B — after Task 7:** review diagnostic lifecycle and transition policy before adapters can mutate flows.
- **Checkpoint C — after Task 9:** run real-device complete-flow acceptance before building the directed lab.
- **Checkpoint D — after Task 12:** review full verification evidence and decide whether to start replay/golden-sample work.

## Risks to watch during implementation

- `SessionPlayer.tsx` is already large. New test logic must enter through extracted diagnostics and one adapter, not additional unrelated local state branches.
- Current exercise discovery comes from multiple sources. The registry contract must make omissions visible without becoming a competing exercise catalog.
- Safari MediaRecorder behavior is intentionally deferred; do not let video capture expand the MVP.
- The admin client is powerful. Keep it confined to the internal-testing server repository, require allowlist authorization before every call, and test that no browser path can access it.
- A test-only force-continue path can accidentally contaminate production state if it calls existing persistence functions. Synthetic transitions must be blocked before those calls, not filtered later in reports.
- Directed runners can become a second product implementation. Extract production runtime seams when reuse is difficult; never copy recognition rules.
- IndexedDB quotas and private-browsing behavior vary. Manual export remains the final recovery path.

## Definition of done

The MVP is complete only when all automated verification commands pass and the manual device acceptance confirms:

- blockers no longer terminate internal flow coverage;
- every current assessment movement and exercise is registry-addressable;
- directed retesting starts in under 30 seconds;
- every issue carries build, device, attempt, and state-timeline evidence;
- failed uploads remain recoverable;
- unauthorized users cannot access internal testing;
- synthetic evidence never changes production assessment, training, progress, recommendation, summary, entitlement, or analytics data.
