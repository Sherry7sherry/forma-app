# Test Lab Specific Landmark Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and speak the specific production-required body regions that are not visible during Test Lab Camera and Calibration phases.

**Architecture:** Add one pure internal-testing landmark-label adapter that translates production profile indices and pose visibility into tester-friendly region names. Directed runners pass their active production tracking requirement into the existing pose snapshot, and the mission panel consumes only those diagnostic labels for UI, voice, and isolated synthetic evidence; readiness remains owned by the existing production camera/tracking path.

**Tech Stack:** TypeScript, React, Next.js, Node test runner, existing `PoseCamera`, `exerciseTracking`, and `voiceCoach` modules.

## Global Constraints

- Use the production movement tracking profile for required landmark indices and minimum visibility; do not create a second movement engine.
- Keep Camera and Calibration pass-button readiness controlled by the existing mission state.
- Store any new diagnostic field only in synthetic internal-test evidence.
- Do not add raw landmark coordinates to React UI state.
- Replay, golden-sample playback, and built-in video capture remain out of scope.
- Do not modify, stage, or commit `CONTEXT.md` or `outputs/`.

---

### Task 1: Translate Missing Production Landmarks Into Body Regions

**Files:**
- Create: `lib/internalTesting/landmarkGuidance.ts`
- Create: `lib/internalTesting/landmarkGuidance.test.ts`
- Modify: `tsconfig.test.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: landmark objects with optional `visibility`, production `requiredLandmarks`, and production `minVisibility`.
- Produces: `missingRequiredBodyParts(input): string[]`, ordered as head, shoulders, hips, knees, ankles, elbows, wrists.

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { missingRequiredBodyParts } from './landmarkGuidance.js'

function landmarks(visibility = 0.9) {
  return Array.from({ length: 33 }, () => ({ visibility }))
}

describe('missing landmark guidance', () => {
  it('groups two missing sides and names a single missing side', () => {
    const pose = landmarks()
    pose[11].visibility = 0.2
    pose[12].visibility = 0.2
    pose[28].visibility = 0.2
    assert.deepEqual(missingRequiredBodyParts({
      landmarks: pose,
      requiredLandmarks: [11, 12, 27, 28],
      minVisibility: 0.45,
    }), ['both shoulders', 'right ankle'])
  })

  it('uses the production threshold boundary and handles missing data safely', () => {
    const pose = landmarks()
    pose[23].visibility = 0.45
    assert.deepEqual(missingRequiredBodyParts({
      landmarks: pose,
      requiredLandmarks: [23],
      minVisibility: 0.45,
    }), [])
    assert.deepEqual(missingRequiredBodyParts({
      landmarks: [],
      requiredLandmarks: [0, 11, 12],
      minVisibility: 0.45,
    }), ['head', 'both shoulders'])
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --test-name-pattern "missing landmark guidance"`

Expected: FAIL because `./landmarkGuidance.js` does not exist.

- [ ] **Step 3: Implement the pure adapter**

Create a typed adapter with the MediaPipe pairs `(11,12)`, `(13,14)`, `(15,16)`, `(23,24)`, `(25,26)`, and `(27,28)`. Treat `visibility < minVisibility` or a missing landmark as missing; equality passes. Collapse two missing required sides to `both <plural>`, name a single side, de-duplicate unknown indices to `required keypoint`, and return labels in the specified priority order.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --test-name-pattern "missing landmark guidance"`

Expected: PASS for bilateral grouping, single-side labels, threshold equality, and empty pose input.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/internalTesting/landmarkGuidance.ts lib/internalTesting/landmarkGuidance.test.ts tsconfig.test.json package.json docs/superpowers/plans/2026-07-15-test-lab-specific-landmark-guidance.md
git commit -m "feat: describe missing tracking landmarks"
```

### Task 2: Thread Active Production Requirements Into Test Lab Snapshots

**Files:**
- Modify: `lib/internalTesting/exerciseMission.ts`
- Modify: `lib/internalTesting/exerciseMission.test.ts`
- Modify: `components/internalTesting/DirectedExerciseRunner.tsx`
- Modify: `components/internalTesting/DirectedAssessmentRunner.tsx`
- Modify: `components/internalTesting/directedRunnerContracts.test.ts`

**Interfaces:**
- Consumes: `trackingProfile.landmarks` and `trackingProfile.minVisibility` from `getExerciseTrackingProfile`.
- Produces: `ExerciseMissionPoseSnapshot.missingBodyParts: string[]` and `poseSnapshotFromResult(result, trackingRequirement)`.

- [ ] **Step 1: Write failing snapshot and runner contract tests**

Add a unit test that calls `poseSnapshotFromResult` with shoulder and ankle visibility below the supplied profile threshold and expects `missingBodyParts` to contain their labels. Add runner contracts requiring both directed runners to pass `trackingProfile.landmarks` and `trackingProfile.minVisibility` to `PoseCamera` and `poseSnapshotFromResult`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --test-name-pattern "missing body parts|production tracking requirement"`

Expected: FAIL because the snapshot has no `missingBodyParts` and the assessment runner does not configure production tracking landmarks.

- [ ] **Step 3: Extend the snapshot without adding raw coordinates**

Update the snapshot contract:

```ts
export interface ExerciseMissionTrackingRequirement {
  landmarks: readonly number[]
  minVisibility: number
}

export interface ExerciseMissionPoseSnapshot {
  // existing scalar diagnostics
  missingBodyParts: string[]
}
```

Change `poseSnapshotFromResult` to accept a `PoseResult`-compatible `landmarks` array plus the tracking requirement and call `missingRequiredBodyParts`. Keep all existing scalar diagnostics unchanged.

- [ ] **Step 4: Reuse the profile in both runners**

The exercise runner passes its existing `trackingProfile` requirement to `poseSnapshotFromResult`. The assessment runner derives the production profile with `getExerciseTrackingProfile(movement.exerciseName, false)`, passes its orientation/landmarks/minimum visibility to `PoseCamera`, passes the same requirement to the snapshot, and uses `seated-torso` framing for the seated assessment.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- --test-name-pattern "missing body parts|production tracking requirement"`

Expected: PASS and no production readiness logic duplicated in a runner.

- [ ] **Step 6: Commit Task 2**

```bash
git add lib/internalTesting/exerciseMission.ts lib/internalTesting/exerciseMission.test.ts components/internalTesting/DirectedExerciseRunner.tsx components/internalTesting/DirectedAssessmentRunner.tsx components/internalTesting/directedRunnerContracts.test.ts
git commit -m "feat: expose missing Test Lab body regions"
```

### Task 3: Show, Speak, and Save Specific Missing Regions

**Files:**
- Modify: `components/internalTesting/ExerciseMissionPanel.tsx`
- Modify: `components/internalTesting/directedRunnerContracts.test.ts`
- Modify: `lib/internalTesting/exerciseMission.test.ts`

**Interfaces:**
- Consumes: `pose.missingBodyParts` from Task 2.
- Produces: a visible `Keypoints needed:` message, throttled voice copy naming at most three regions, and a comma-separated `missingBodyParts` field in synthetic quick-action evidence.

- [ ] **Step 1: Write failing UI/voice/evidence contract tests**

Require the panel to format only `pose.missingBodyParts.slice(0, 3)`, include `Keypoints needed:`, use that copy from both camera and calibration guidance, and add `missingBodyParts` to `countDiagnosticEvidence`. Extend the existing internal-event test to assert `productionEvidence === false` remains intact when that field is supplied.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --test-name-pattern "specific missing regions|missing region evidence"`

Expected: FAIL because the panel still renders and speaks generic guidance only.

- [ ] **Step 3: Implement concise visible and voice copy**

Add helpers that join one, two, or three labels naturally and choose placement copy: lower-body labels suggest tilting down or moving back; head/shoulder labels suggest tilting up or moving back; other labels suggest centering and improving lighting. Keep no-body guidance generic. Render the specific warning only during a failing Camera or Calibration phase, and let the existing pass notice replace it immediately after readiness succeeds.

- [ ] **Step 4: Add isolated evidence**

Add this scalar to `countDiagnosticEvidence`:

```ts
missingBodyParts: pose?.missingBodyParts.join(', ') || null,
```

This flows only through existing internal synthetic quick actions and must not be added to production analytics or session evidence.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
npm test -- --test-name-pattern "specific missing regions|missing region evidence"
npm test
npm run lint
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy STRIPE_PRO_YEARLY_PRICE_ID=price_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
git diff --check
```

Expected: all tests pass, lint and build exit 0, and `git diff --check` prints no errors.

- [ ] **Step 6: Commit Task 3**

```bash
git add components/internalTesting/ExerciseMissionPanel.tsx components/internalTesting/directedRunnerContracts.test.ts lib/internalTesting/exerciseMission.test.ts
git commit -m "feat: guide testers to missing body regions"
```

### Task 4: Publish and Confirm Production Deployment

**Files:**
- No code changes.

**Interfaces:**
- Consumes: the verified branch commits from Tasks 1–3.
- Produces: a merged GitHub pull request and a successful Vercel production deployment.

- [ ] **Step 1: Confirm scope before publishing**

Run: `git status --short --branch && git log --oneline origin/master..HEAD`

Expected: only the design, plan, tests, and landmark-guidance implementation are ahead of `origin/master`; `CONTEXT.md` and `outputs/` remain untracked.

- [ ] **Step 2: Push and create the pull request**

Push `codex/test-lab-specific-landmark-guidance`, create a ready PR summarizing the specific-region UI/voice behavior and production-profile reuse, and wait for required checks.

- [ ] **Step 3: Merge and verify deployment**

Merge only after checks pass. Poll the merge commit status until Vercel reports `success`, then report the PR URL, merge commit, and deployment record.
