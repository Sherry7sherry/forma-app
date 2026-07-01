# Body Assessment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reliable two-minute movement assessment that creates Body Mirror evidence, keeps camera and partial failures honest, and gives Session one unified soft-prompt versus safety-block policy.

**Architecture:** A new deep `lib/bodyAssessment` module converts timestamped MediaPipe samples into stable evidence and persistence payloads. A dedicated authenticated `/assessment` route owns the full-screen flow and incrementally saves evidence. Home, Progress, and Session continue to consume `BodyMirrorResult`; Session receives a derived policy and never recalculates body state.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/Postgres RLS, MediaPipe Pose through the existing `PoseCamera`, Tailwind CSS, Node test runner.

## Global Constraints

- Compare only with the user's own reliable baseline; never produce a diagnosis or universal body score.
- The MVP movements are `side_arm_raise`, `standing_roll_down`, and `seated_trunk_rotation`.
- Confidence at or above `0.70` is required before movement observations update the mirror.
- Missing baseline means prompt assessment but allow **Continue without assessment**.
- A current safety signal means hard block; Session must consume the unified Body Mirror policy.
- Camera refusal enters self-report fallback and does not create numeric movement observations.
- Partial, camera-unavailable, and low-confidence attempts remain evidence but do not update dimensions.
- The assessment is not subscription-only.
- Training-after summary and `body_feel_after` writing remain out of scope.
- Preserve existing Forma colors, typography, radii, and camera-first interaction language.

---

### Task 1: Stable assessment metrics

**Files:**
- Create: `lib/bodyAssessment/types.ts`
- Create: `lib/bodyAssessment/metrics.ts`
- Create: `lib/bodyAssessment/metrics.test.ts`
- Create: `lib/bodyAssessment/index.ts`

**Interfaces:**
- Consumes: MediaPipe-compatible `PoseLandmark[]` samples with `capturedAt` and `bodyConfidence`.
- Produces: `deriveMovementObservations(movement, samples): MovementDerivation`, where the result is either `{ status: 'reliable'; overallConfidence; observations }` or `{ status: 'low_confidence'; overallConfidence; reason }`.

- [ ] **Step 1: Write failing metric contract tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deriveMovementObservations } from './metrics'

describe('deriveMovementObservations', () => {
  it('emits stable mobility and control contracts for every MVP movement', () => {
    for (const movement of ['side_arm_raise', 'standing_roll_down', 'seated_trunk_rotation'] as const) {
      const result = deriveMovementObservations(movement, fixtureSamples(movement))
      assert.equal(result.status, 'reliable')
      if (result.status !== 'reliable') return
      assert.deepEqual(new Set(result.observations.map(item => item.dimension)), new Set(['mobility', 'control']))
      assert.ok(result.observations.every(item => item.metricKey && item.unit && item.changeThreshold > 0))
    }
  })

  it('rejects translated, missing-landmark, insufficient-range, and sub-0.70 samples honestly', () => {
    assert.equal(deriveMovementObservations('side_arm_raise', lowConfidenceSamples()).status, 'low_confidence')
    assert.equal(deriveMovementObservations('standing_roll_down', missingWristSamples()).status, 'low_confidence')
    assert.equal(deriveMovementObservations('seated_trunk_rotation', stillSamples()).status, 'low_confidence')
  })
})
```

- [ ] **Step 2: Run the metric test and verify RED**

Run: `npm test -- lib/bodyAssessment/metrics.test.ts`

Expected: FAIL because `./metrics` and its interface do not exist.

- [ ] **Step 3: Implement typed samples and stable metric derivation**

```ts
export interface AssessmentPoseSample {
  capturedAt: number
  bodyConfidence: number
  landmarks: PoseLandmark[]
}

export type MovementDerivation =
  | { status: 'reliable'; overallConfidence: number; observations: DerivedObservation[] }
  | { status: 'low_confidence'; overallConfidence: number; reason: AssessmentFailureReason }

export function deriveMovementObservations(
  movement: BodyMirrorMovement,
  samples: AssessmentPoseSample[],
): MovementDerivation {
  const usable = samples.filter(sample => sample.bodyConfidence >= BODY_MIRROR_CONFIDENCE_THRESHOLD)
  if (!hasRequiredCoverage(movement, usable)) return lowConfidence(usable, 'landmarks')
  if (!hasMeaningfulRange(movement, usable)) return lowConfidence(usable, 'range')
  return deriveConfiguredMetrics(movement, normalizeSamples(usable))
}
```

Use durable contracts:

```ts
const METRICS = {
  side_arm_raise: [
    metric('mobility', 'max_arm_elevation_deg', 'deg', 'higher', 5),
    metric('control', 'torso_drift_ratio', 'ratio', 'lower', 0.05),
  ],
  standing_roll_down: [
    metric('mobility', 'normalized_wrist_descent', 'ratio', 'higher', 0.08),
    metric('control', 'lateral_torso_drift_ratio', 'ratio', 'lower', 0.04),
  ],
  seated_trunk_rotation: [
    metric('mobility', 'shoulder_rotation_range_ratio', 'ratio', 'higher', 0.08),
    metric('control', 'pelvis_drift_ratio', 'ratio', 'lower', 0.04),
  ],
} as const
```

- [ ] **Step 4: Run metric tests and verify GREEN**

Run: `npm test -- lib/bodyAssessment/metrics.test.ts`

Expected: PASS with translation-normalized values, stable keys, and honest low-confidence outcomes.

- [ ] **Step 5: Commit the metric module**

```bash
git add lib/bodyAssessment/types.ts lib/bodyAssessment/metrics.ts lib/bodyAssessment/metrics.test.ts lib/bodyAssessment/index.ts
git commit -m "feat: derive body assessment evidence"
```

---

### Task 2: Evidence payloads and unified Session policy

**Files:**
- Create: `lib/bodyAssessment/persistence.ts`
- Create: `lib/bodyAssessment/persistence.test.ts`
- Create: `lib/bodyMirror/sessionPolicy.ts`
- Create: `lib/bodyMirror/sessionPolicy.test.ts`
- Modify: `lib/bodyMirror/checkIn.ts`
- Modify: `lib/bodyMirror/checkIn.test.ts`
- Modify: `lib/bodyMirror/index.ts`
- Modify: `lib/bodyMirror/types.ts`

**Interfaces:**
- Consumes: reliable movement derivations, user id, attempt kind, assessment id, and `BodyMirrorResult`.
- Produces: Supabase insert/update payloads and `deriveSessionBodyPolicy(result): 'allow' | 'prompt_assessment' | 'block_safety'`.

- [ ] **Step 1: Write failing payload and policy tests**

```ts
it('builds baseline and reassessment rows without inventing completed evidence', () => {
  assert.equal(buildAssessmentInsert({ userId: 'u1', kind: 'baseline', captureMode: 'camera' }).status, 'in_progress')
  assert.equal(buildAssessmentCompletion({ outcome: 'partial' }).status, 'partial')
  assert.equal(buildAssessmentCompletion({ outcome: 'camera_unavailable' }).overall_confidence, null)
})

it('prompts without a baseline, allows skipping, and blocks only safety holds', () => {
  assert.equal(deriveSessionBodyPolicy(result({ status: 'no_data' })), 'prompt_assessment')
  assert.equal(deriveSessionBodyPolicy(result({ status: 'low_confidence' })), 'prompt_assessment')
  assert.equal(deriveSessionBodyPolicy(result({ status: 'safety_hold' })), 'block_safety')
  assert.equal(deriveSessionBodyPolicy(result({ status: 'current' })), 'allow')
})
```

- [ ] **Step 2: Run payload and policy tests and verify RED**

Run: `npm test -- lib/bodyAssessment/persistence.test.ts lib/bodyMirror/sessionPolicy.test.ts lib/bodyMirror/checkIn.test.ts`

Expected: FAIL because the builders, policy, and contextual check-in interface are absent.

- [ ] **Step 3: Implement payload builders and generalize check-in context**

```ts
export interface BodyCheckInInput {
  userId: string
  context?: 'baseline' | 'daily' | 'pre_session' | 'post_session'
  comfort: number
  focusAreas: string[]
  safetySignals: string[]
  recordedAt?: string
}

return {
  user_id: input.userId,
  context: input.context ?? 'daily',
  comfort: input.comfort,
  focus_areas: unique(input.focusAreas),
  safety_signals: validatedSignals,
  recorded_at: input.recordedAt ?? new Date().toISOString(),
}
```

```ts
export function deriveSessionBodyPolicy(result: BodyMirrorResult): SessionBodyPolicy {
  if (result.safety.shouldPause) return 'block_safety'
  if (result.dimensions.mobility.state === 'no_data' || result.dimensions.control.state === 'no_data') {
    return 'prompt_assessment'
  }
  return 'allow'
}
```

- [ ] **Step 4: Run payload, policy, and existing Body Mirror tests and verify GREEN**

Run: `npm test -- lib/bodyAssessment/persistence.test.ts lib/bodyMirror/sessionPolicy.test.ts lib/bodyMirror/checkIn.test.ts lib/bodyMirror/deriveBodyMirror.test.ts`

Expected: PASS; safety remains derived once and old daily check-in calls still default to `daily`.

- [ ] **Step 5: Commit payload and policy modules**

```bash
git add lib/bodyAssessment lib/bodyMirror/checkIn.ts lib/bodyMirror/checkIn.test.ts lib/bodyMirror/sessionPolicy.ts lib/bodyMirror/sessionPolicy.test.ts lib/bodyMirror/index.ts lib/bodyMirror/types.ts
git commit -m "feat: define assessment evidence policy"
```

---

### Task 3: Camera status seam and assessment flow

**Files:**
- Modify: `components/camera/PoseCamera.tsx`
- Modify: `lib/poseCameraConfig.test.ts`
- Create: `app/assessment/page.tsx`
- Create: `app/assessment/BodyAssessmentFlow.tsx`
- Create: `lib/bodyAssessment/assessmentFlow.test.ts`

**Interfaces:**
- Consumes: `PoseCamera` pose results and optional `onCameraStatus(status)` events.
- Produces: authenticated full-screen assessment with intro, comfort/safety, three camera movements, self-report fallback, partial exit, and completion.

- [ ] **Step 1: Write failing camera and screen contract tests**

```ts
it('exposes camera status without changing existing callers', () => {
  assert.match(cameraSource, /onCameraStatus\?:/)
  assert.match(cameraSource, /onCameraStatusRef/)
})

it('renders every assessment state and persists before advancing', () => {
  assert.match(flowSource, /intro.*check-in.*setup.*capture.*complete/s)
  assert.match(flowSource, /camera_unavailable/)
  assert.match(flowSource, /partial/)
  assert.match(flowSource, /deriveMovementObservations/)
})
```

- [ ] **Step 2: Run camera and flow tests and verify RED**

Run: `npm test -- lib/poseCameraConfig.test.ts lib/bodyAssessment/assessmentFlow.test.ts`

Expected: FAIL because the optional camera status interface and route do not exist.

- [ ] **Step 3: Add the optional camera status callback**

```ts
export type CameraStatus = 'loading' | 'ready' | 'unavailable'

interface Props {
  onPoseResult?: (result: PoseResult) => void
  onCameraStatus?: (status: CameraStatus) => void
  // existing props stay unchanged
}
```

Mirror the callback in a ref exactly as `onPoseResult` is mirrored, and emit status only when the internal camera state changes. Omitting the callback must preserve Session behavior.

- [ ] **Step 4: Implement the authenticated route and explicit state machine**

```ts
type AssessmentStep =
  | { kind: 'intro' }
  | { kind: 'check_in' }
  | { kind: 'setup'; movementIndex: number }
  | { kind: 'capture'; movementIndex: number }
  | { kind: 'fallback'; movementIndex: number }
  | { kind: 'result'; outcome: 'completed' | 'low_confidence' | 'camera_unavailable' | 'safety_hold' }
```

The route must:

- infer `baseline` versus `reassessment` from the loaded Body Mirror;
- insert the check-in before movement capture;
- create one assessment row and incrementally upsert observations;
- keep samples in memory until an observation save succeeds;
- mark `partial` on explicit exit after creation;
- mark `low_confidence` after a failed complete attempt;
- mark `camera_unavailable` when fallback is chosen;
- return Home after a reliable completion or saved fallback.

- [ ] **Step 5: Run camera and assessment-flow tests and verify GREEN**

Run: `npm test -- lib/poseCameraConfig.test.ts lib/bodyAssessment/assessmentFlow.test.ts lib/bodyAssessment/metrics.test.ts lib/bodyAssessment/persistence.test.ts`

Expected: PASS with the optional callback, all route states, and incremental persistence contracts.

- [ ] **Step 6: Commit the assessment route**

```bash
git add components/camera/PoseCamera.tsx lib/poseCameraConfig.test.ts app/assessment lib/bodyAssessment
git commit -m "feat: add guided body assessment"
```

---

### Task 4: Connect Home and Session without duplicating body state

**Files:**
- Modify: `app/(app)/home/page.tsx`
- Modify: `lib/bodyMirror/bodyMirrorPages.test.ts`
- Modify: `app/session/[id]/page.tsx`
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Modify: `lib/repFeedback.test.ts`

**Interfaces:**
- Consumes: Home recommendation mode and `SessionBodyPolicy` from the Body Mirror module.
- Produces: correct Home assessment CTA, separate daily check-in, Session soft prompt, and Session safety block.

- [ ] **Step 1: Write failing Home and Session contract tests**

```ts
it('routes baseline and reassessment recommendations to the assessment flow', () => {
  assert.match(homeSource, /href="\/assessment"/)
  assert.match(homeSource, /Start 2-minute assessment/)
  assert.match(homeSource, /BodyCheckInSheet[\s\S]*Keep today current/)
})

it('uses one Body Mirror policy for Session gating', () => {
  assert.match(sessionPageSource, /loadBodyMirrorForUser/)
  assert.match(sessionPageSource, /deriveSessionBodyPolicy/)
  assert.match(playerSource, /Continue without assessment/)
  assert.match(playerSource, /Assess first/)
  assert.match(playerSource, /block_safety/)
})
```

- [ ] **Step 2: Run Home and Session tests and verify RED**

Run: `npm test -- lib/bodyMirror/bodyMirrorPages.test.ts lib/repFeedback.test.ts`

Expected: FAIL because Home still opens `BodyCheckInSheet` and Session does not load Body Mirror.

- [ ] **Step 3: Replace only the baseline/reassessment Home action**

```tsx
if (mode === 'baseline' || mode === 'reassess') {
  return (
    <div className="mt-5">
      <Link href="/assessment" className="btn-primary w-full">
        {mode === 'baseline' ? 'Start 2-minute assessment' : 'Refresh body assessment'}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <p className="mt-3 rounded-2xl bg-cream-dark px-4 py-3 text-xs leading-relaxed text-charcoal-mid">
        Three no-mat movements · about 2 minutes · camera optional
      </p>
    </div>
  )
}
```

Keep `BodyCheckInSheet` for recommendation mode `check_in` and the separate **Keep today current** card.

- [ ] **Step 4: Load and pass the unified Session policy**

```ts
const bodyMirrorLoad = await loadBodyMirrorForUser(supabase, user.id)
const bodyPolicy = bodyMirrorLoad.result
  ? deriveSessionBodyPolicy(bodyMirrorLoad.result)
  : 'allow'
```

`SessionPlayer` shows a pre-start prompt for `prompt_assessment`, with `/assessment` and **Continue without assessment** actions. For `block_safety`, it does not create a `session_records` row and shows the existing non-diagnostic safety guidance with a return-to-Home action.

- [ ] **Step 5: Run Home, Session, and unified-state tests and verify GREEN**

Run: `npm test -- lib/bodyMirror/bodyMirrorPages.test.ts lib/bodyMirror/sessionPolicy.test.ts lib/repFeedback.test.ts lib/bodyMirror/deriveBodyMirror.test.ts`

Expected: PASS; missing baseline is skippable, safety is not, and Home’s daily check-in remains independent.

- [ ] **Step 6: Commit integrations**

```bash
git add 'app/(app)/home/page.tsx' 'app/session/[id]/page.tsx' 'app/session/[id]/SessionPlayer.tsx' lib/bodyMirror/bodyMirrorPages.test.ts lib/bodyMirror/sessionPolicy.test.ts lib/repFeedback.test.ts
git commit -m "feat: connect assessment to recommendations"
```

---

### Task 5: Full verification and visual QA

**Files:**
- Modify: `design-qa.md`
- Test: all repository tests and production build

**Interfaces:**
- Consumes: completed assessment implementation.
- Produces: fresh automated evidence and authenticated browser evidence for every critical flow state.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
SUPABASE_SERVICE_ROLE_KEY=dummy \
STRIPE_SECRET_KEY=sk_test_dummy \
STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy \
STRIPE_PRO_YEARLY_PRICE_ID=price_dummy \
STRIPE_WEBHOOK_SECRET=whsec_dummy \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
npm run build
```

Expected: every command exits 0 with no lint warnings, type errors, failed tests, or build failures.

- [ ] **Step 2: Verify authenticated critical states in Chrome**

Check:

- Home baseline CTA and separate daily check-in;
- intro and comfort/safety steps;
- each movement’s setup and camera capture;
- camera-denied fallback;
- low-confidence result;
- partial exit;
- reliable completion returning to updated Home;
- Session prompt with working skip;
- Session safety block with no session record created.

- [ ] **Step 3: Record visual QA**

Update project-root `design-qa.md` with source references, implementation screenshots, viewport, state coverage, findings, patches, and exactly `final result: passed` only when no P0/P1/P2 issue remains.

- [ ] **Step 4: Commit verification evidence**

```bash
git add design-qa.md
git commit -m "docs: verify body assessment flow"
```
