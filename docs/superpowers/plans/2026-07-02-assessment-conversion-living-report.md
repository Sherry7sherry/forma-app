# Assessment Conversion and Living Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Forma’s signed-in movement assessment into a safe guest acquisition flow that reveals one evidence-backed insight before registration, persists a useful free report after registration, and establishes the deterministic coaching-policy seam used by later subscription adaptation.

**Architecture:** Keep MediaPipe measurement and Body Mirror derivation unchanged behind their existing modules. Add two deep pure modules: `screenAssessment()` converts choice-first intake into assessment routing, while `evaluateCoaching()` converts normalized intake, Body Mirror evidence, and exercise metadata into traceable insights and plan constraints. The guest UI stores a versioned payload in `sessionStorage`; after authentication, a save route persists intake, assessment evidence, and a deterministic report version before rendering the free report.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript 5, Supabase/Postgres with RLS, MediaPipe through the existing `PoseCamera`, Stripe through existing checkout routes, Node test runner, ESLint, Tailwind CSS, Lucide React.

## Global Constraints

- This is a general-wellness product; never diagnose, name suspected pathology, or claim treatment.
- Safety is deterministic and always precedes recommendation ranking.
- Stop guidance and safety information are always free and suppress every subscription prompt.
- Raw camera video is never uploaded or stored by this feature.
- Guest data remains in `sessionStorage` until an authenticated user explicitly saves it.
- Low-confidence, partial, stale, and self-report-only attempts cannot create numeric movement conclusions.
- Home, Progress, Session, and reports must consume the same Body Mirror evidence and policy output.
- No universal body score, population ranking, fear-based sales, countdown paywall, or lost-streak threat.
- Extend the existing cream, sage, rose, Lora/Inter, rounded-card visual system; do not introduce a second design system.
- Do not alter or delete existing untracked `CONTEXT.md` or `outputs/` content.

## Delivery stages

1. **Stage A — policy foundation:** Tasks 1–4. Independently testable pure rules and persistence schema.
2. **Stage B — free acquisition loop:** Tasks 5–8. Guest intake, existing camera assessment reuse, first insight, registration transfer, and free report.
3. **Stage C — subscription loop:** Tasks 9–11. Free first session, trial transition, report updates, and analytics/privacy verification.

---

### Task 1: Choice-first intake types and deterministic screening

**Files:**
- Create: `lib/assessmentIntake/types.ts`
- Create: `lib/assessmentIntake/screenAssessment.ts`
- Create: `lib/assessmentIntake/screenAssessment.test.ts`
- Create: `lib/assessmentIntake/index.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: no application state; only `AssessmentIntake`.
- Produces: `screenAssessment(input: AssessmentIntake): AssessmentRoute` and version constant `ASSESSMENT_INTAKE_VERSION`.

- [ ] **Step 1: Write failing table-driven screening tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { screenAssessment } from './screenAssessment.js'
import type { AssessmentIntake } from './types.js'

const base: AssessmentIntake = {
  version: 1,
  goals: ['reduce_sitting_stiffness'],
  focusRegions: ['neck_shoulders'],
  sensation: 'tight',
  injuryStatus: 'none',
  injuryRegions: [],
  movementFrequency: 'rarely',
  workPattern: 'sitting_over_8h',
  availableMinutes: 5,
  safetySignals: [],
}

describe('screenAssessment', () => {
  it('routes a normal intake to standard assessment', () => {
    assert.deepEqual(screenAssessment(base).mode, 'standard')
  })

  it('modifies but does not stop for a recovered shoulder history', () => {
    const result = screenAssessment({
      ...base,
      injuryStatus: 'recovered',
      injuryRegions: ['right_shoulder'],
    })
    assert.equal(result.mode, 'modified')
    assert.ok(result.constraints.some(item => item.kind === 'optional_single_arm_compare'))
  })

  it('stops for a current stop signal', () => {
    const result = screenAssessment({ ...base, safetySignals: ['numbness'] })
    assert.equal(result.mode, 'stop')
    assert.deepEqual(result.reasons.map(reason => reason.ruleId), ['SAFETY_CURRENT_STOP_SIGNAL'])
  })
})
```

- [ ] **Step 2: Add the new files to `tsconfig.test.json` and verify RED**

Add `lib/assessmentIntake/types.ts`, `screenAssessment.ts`, `index.ts`, and `screenAssessment.test.ts` to `include`.

Run: `npm test`

Expected: compilation fails because `screenAssessment` and its types do not exist.

- [ ] **Step 3: Define normalized intake and route types**

```ts
export const ASSESSMENT_INTAKE_VERSION = 1 as const

export type IntakeSafetySignal =
  | 'sharp_pain'
  | 'numbness'
  | 'radiating_pain'
  | 'dizziness'
  | 'professional_pause'

export interface AssessmentIntake {
  version: typeof ASSESSMENT_INTAKE_VERSION
  goals: string[]
  focusRegions: string[]
  sensation: 'none' | 'tight' | 'achy' | 'painful' | 'numb_or_radiating'
  injuryStatus: 'none' | 'recovered' | 'occasional' | 'recovering'
  injuryRegions: string[]
  movementFrequency: 'rarely' | 'weekly_1' | 'weekly_2_3' | 'weekly_4_plus'
  workPattern: 'sitting_under_4h' | 'sitting_4_8h' | 'sitting_over_8h' | 'mostly_moving'
  availableMinutes: 5 | 15 | 30
  safetySignals: IntakeSafetySignal[]
}

export interface PolicyReason {
  ruleId: string
  evidencePaths: string[]
  userMessage: string
}

export type MovementConstraint =
  | { kind: 'reduce_range'; movement: 'side_arm_raise' | 'standing_roll_down' | 'seated_trunk_rotation' }
  | { kind: 'skip_movement'; movement: 'side_arm_raise' | 'standing_roll_down' | 'seated_trunk_rotation' }
  | { kind: 'optional_single_arm_compare'; movement: 'side_arm_raise' }

export type AssessmentRoute =
  | { mode: 'standard'; constraints: []; reasons: PolicyReason[] }
  | { mode: 'modified'; constraints: MovementConstraint[]; reasons: PolicyReason[] }
  | { mode: 'stop'; constraints: []; reasons: PolicyReason[] }
```

- [ ] **Step 4: Implement explicit priority-ordered screening**

```ts
import type { AssessmentIntake, AssessmentRoute, MovementConstraint, PolicyReason } from './types'

export function screenAssessment(input: AssessmentIntake): AssessmentRoute {
  if (input.safetySignals.length > 0 || input.sensation === 'numb_or_radiating') {
    return {
      mode: 'stop',
      constraints: [],
      reasons: [{
        ruleId: 'SAFETY_CURRENT_STOP_SIGNAL',
        evidencePaths: ['intake.safetySignals', 'intake.sensation'],
        userMessage: 'Your current answers include a signal that should pause movement assessment.',
      }],
    }
  }

  const constraints: MovementConstraint[] = []
  const reasons: PolicyReason[] = []
  const shoulderHistory = input.injuryRegions.some(region => region.includes('shoulder'))
  const backHistory = input.injuryRegions.some(region => region.includes('back'))

  if (shoulderHistory && input.injuryStatus !== 'none') {
    constraints.push({ kind: 'reduce_range', movement: 'side_arm_raise' })
    constraints.push({ kind: 'optional_single_arm_compare', movement: 'side_arm_raise' })
    reasons.push({
      ruleId: 'INJURY_SHOULDER_MODIFY',
      evidencePaths: ['intake.injuryStatus', 'intake.injuryRegions'],
      userMessage: 'The arm raise will start in a smaller comfortable range.',
    })
  }
  if (backHistory && input.injuryStatus === 'recovering') {
    constraints.push({ kind: 'reduce_range', movement: 'standing_roll_down' })
    reasons.push({
      ruleId: 'INJURY_BACK_REDUCE_RANGE',
      evidencePaths: ['intake.injuryStatus', 'intake.injuryRegions'],
      userMessage: 'The roll down will use a smaller comfortable range.',
    })
  }

  return constraints.length
    ? { mode: 'modified', constraints, reasons }
    : { mode: 'standard', constraints: [], reasons }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add lib/assessmentIntake tsconfig.test.json
git commit -m "feat: add deterministic assessment screening"
```

---

### Task 2: Traceable coaching-policy module

**Files:**
- Create: `lib/coachingPolicy/types.ts`
- Create: `lib/coachingPolicy/evaluateCoaching.ts`
- Create: `lib/coachingPolicy/evaluateCoaching.test.ts`
- Create: `lib/coachingPolicy/index.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: `AssessmentIntake`, `AssessmentRoute`, `BodyMirrorResult`, normalized movement observations, and exercise profiles.
- Produces: `evaluateCoaching(input: CoachingInput): CoachingDecision` with `trace` and evidence-backed `insights`.

- [ ] **Step 1: Write failing priority and evidence tests**

```ts
it('never lets a preference override stop', () => {
  const decision = evaluateCoaching(input({ safetySignals: ['sharp_pain'] }))
  assert.equal(decision.safety, 'stop')
  assert.deepEqual(decision.plan.preferredExerciseIds, [])
})

it('creates a torso-drift insight only from reliable evidence', () => {
  const decision = evaluateCoaching(input({}, [{
    id: 'obs-1', metricKey: 'arm_raise_torso_drift_ratio', value: 0.16, confidence: 0.88,
  }]))
  assert.equal(decision.insights[0]?.claimKey, 'arm_raise_torso_drift')
  assert.deepEqual(decision.insights[0]?.evidenceIds, ['obs-1'])
})

it('excludes before ranking', () => {
  const decision = evaluateCoaching(input({ injuryRegions: ['right_shoulder'], injuryStatus: 'recovering' }))
  assert.ok(decision.plan.excludedExerciseIds.includes('advanced-overhead'))
  assert.ok(!decision.plan.preferredExerciseIds.includes('advanced-overhead'))
})
```

- [ ] **Step 2: Verify RED**

Run: `npm test`

Expected: compilation fails because `evaluateCoaching` does not exist.

- [ ] **Step 3: Define the decision interface**

```ts
export interface CoachingInsight {
  id: string
  claimKey: 'arm_raise_torso_drift' | 'controlled_forward_bend' | 'rotation_difference'
  evidenceIds: string[]
  confidence: number
  focusArea: 'shoulder_mobility' | 'trunk_control' | 'spine_mobility'
  allowedClaim: string
}

export interface RuleTrace {
  ruleId: string
  priority: number
  evidenceIds: string[]
  effect: 'stop' | 'exclude' | 'regress' | 'prefer' | 'insight'
}

export interface CoachingDecision {
  engineVersion: '1.0.0'
  safety: 'allow' | 'modify' | 'stop'
  insights: CoachingInsight[]
  plan: {
    intensity: 'gentle' | 'standard'
    durationMinutes: 5 | 15 | 30
    focusAreas: string[]
    preferredExerciseIds: string[]
    excludedExerciseIds: string[]
    regressions: Record<string, string>
  }
  trace: RuleTrace[]
}

export interface CoachingObservation {
  id: string
  metricKey: string
  value: number
  confidence: number
}

export interface ExerciseProfile {
  id: string
  focusAreas: string[]
  painSensitiveRegions: string[]
  difficulty: 'gentle' | 'beginner' | 'intermediate' | 'advanced'
}

export interface CoachingInput {
  intake: AssessmentIntake
  route: AssessmentRoute
  bodyMirror: BodyMirrorResult
  observations: CoachingObservation[]
  exercises: ExerciseProfile[]
}
```

- [ ] **Step 4: Implement the evaluator as explicit phases**

Implement one exported function that performs, in order: stop short-circuit, exclusions, regressions, insight extraction at confidence `>= 0.70`, preference scoring, and final plan assembly. Use set union for exclusions and remove excluded IDs from preferred IDs after ranking. Start with the approved shoulder/torso-drift rules; add further rules only with a failing test and reviewed claim copy.

```ts
function canonicalRegion(value: string): string {
  if (value.includes('shoulder')) return 'shoulders'
  if (value.includes('back')) return 'low back'
  if (value.includes('knee')) return 'knees'
  if (value.includes('hip')) return 'hips'
  return value
}

export function evaluateCoaching(input: CoachingInput): CoachingDecision {
  const trace: RuleTrace[] = []
  if (input.route.mode === 'stop' || input.bodyMirror.safety.shouldPause) {
    trace.push({ ruleId: 'SAFETY_STOP', priority: 1000, evidenceIds: [], effect: 'stop' })
    return {
      engineVersion: '1.0.0',
      safety: 'stop',
      insights: [],
      plan: {
        intensity: 'gentle',
        durationMinutes: input.intake.availableMinutes,
        focusAreas: [],
        preferredExerciseIds: [],
        excludedExerciseIds: input.exercises.map(exercise => exercise.id),
        regressions: {},
      },
      trace,
    }
  }

  const activeInjuryRegions = input.intake.injuryStatus === 'recovering'
    ? input.intake.injuryRegions.map(canonicalRegion)
    : []
  const excluded = new Set(input.exercises
    .filter(exercise => exercise.painSensitiveRegions
      .map(canonicalRegion)
      .some(region => activeInjuryRegions.includes(region)))
    .map(exercise => exercise.id))
  for (const exerciseId of excluded) {
    trace.push({ ruleId: 'ACTIVE_INJURY_EXCLUDE', priority: 800, evidenceIds: [], effect: 'exclude' })
  }

  const torsoDrift = input.observations.find(observation =>
    observation.metricKey === 'arm_raise_torso_drift_ratio'
    && observation.confidence >= 0.70
    && observation.value >= 0.12,
  )
  const insights: CoachingInsight[] = torsoDrift ? [{
    id: 'insight-arm-raise-torso-drift',
    claimKey: 'arm_raise_torso_drift',
    evidenceIds: [torsoDrift.id],
    confidence: torsoDrift.confidence,
    focusArea: 'trunk_control',
    allowedClaim: 'More torso lean was observed during arm raising.',
  }] : []
  if (torsoDrift) {
    trace.push({
      ruleId: 'ARM_RAISE_TORSO_DRIFT',
      priority: 400,
      evidenceIds: [torsoDrift.id],
      effect: 'insight',
    })
  }

  const focusAreas = [...new Set([
    ...input.intake.goals,
    ...insights.map(insight => insight.focusArea),
  ])]
  const preferred = input.exercises
    .filter(exercise => !excluded.has(exercise.id))
    .filter(exercise => exercise.focusAreas.some(area => focusAreas.includes(area)))
    .sort((a, b) => Number(a.difficulty !== 'gentle') - Number(b.difficulty !== 'gentle'))
    .map(exercise => exercise.id)
  for (const exerciseId of preferred) {
    trace.push({ ruleId: 'FOCUS_AREA_PREFER', priority: 200, evidenceIds: [], effect: 'prefer' })
  }

  return {
    engineVersion: '1.0.0',
    safety: input.route.mode === 'modified' ? 'modify' : 'allow',
    insights,
    plan: {
      intensity: input.route.mode === 'modified' ? 'gentle' : 'standard',
      durationMinutes: input.intake.availableMinutes,
      focusAreas,
      preferredExerciseIds: preferred,
      excludedExerciseIds: [...excluded],
      regressions: {},
    },
    trace,
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests pass, including stop priority and evidence references.

```bash
git add lib/coachingPolicy tsconfig.test.json
git commit -m "feat: add traceable coaching policy"
```

---

### Task 3: Versioned intake and report persistence

**Files:**
- Create: `supabase/migrations/008_assessment_intake_reports.sql`
- Create: `lib/assessmentReport/persistence.ts`
- Create: `lib/assessmentReport/persistence.test.ts`
- Modify: `lib/bodyMirror/types.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: authenticated user ID, assessment ID, versioned intake, and structured report.
- Produces: validated insert payload builders; database tables protected by user-scoped RLS.

- [ ] **Step 1: Write migration contract tests**

Read the SQL file as text and assert that both tables enable RLS, policies include both `using` and `with check`, report rows reference an assessment and intake version, and guest/raw-video columns do not exist.

```ts
assert.match(sql, /create table if not exists public\.health_intake_versions/)
assert.match(sql, /create table if not exists public\.body_report_versions/)
assert.match(sql, /alter table public\.health_intake_versions enable row level security/)
assert.match(sql, /with check \(auth\.uid\(\) = user_id\)/)
assert.doesNotMatch(sql, /raw_video|video_url|guest_email/)
```

- [ ] **Step 2: Verify RED**

Run: `npm test`

Expected: test fails because migration and builders do not exist.

- [ ] **Step 3: Add immutable version tables**

```sql
create table if not exists public.health_intake_versions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  assessment_id uuid,
  intake_version integer not null check (intake_version > 0),
  answers jsonb not null,
  safety_state text not null check (safety_state in ('standard','modified','stop')),
  constraints jsonb not null default '[]',
  plan_preferences jsonb not null default '{}',
  consent_version text not null,
  created_at timestamptz not null default now(),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id) on delete set null
);

create table if not exists public.body_report_versions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  assessment_id uuid,
  intake_version_id uuid references public.health_intake_versions(id) on delete set null,
  report_version integer not null check (report_version > 0),
  engine_version text not null,
  report jsonb not null,
  evidence_refs jsonb not null default '[]',
  change_summary text,
  generated_at timestamptz not null default now(),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id) on delete set null
);
```

Add user/time indexes, enable RLS, and create select/insert/update/delete policies using `auth.uid() = user_id` with matching `with check`.

Also replace the `body_check_ins_safety_signals_check` constraint so the approved value `professional_pause` can be persisted, add it to `SafetySignal` in `lib/bodyMirror/types.ts`, and add it to the migration contract test. Existing values remain unchanged.

- [ ] **Step 4: Add strict payload builders**

The builders reject mismatched user IDs, missing consent version, empty report evidence, and reports containing unsupported claim keys. They return snake-case Supabase payloads without performing I/O.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all migration and builder tests pass.

```bash
git add supabase/migrations/008_assessment_intake_reports.sql lib/assessmentReport tsconfig.test.json
git commit -m "feat: persist versioned intake and reports"
```

---

### Task 4: Deterministic report composer

**Files:**
- Create: `lib/assessmentReport/types.ts`
- Create: `lib/assessmentReport/composeReport.ts`
- Create: `lib/assessmentReport/composeReport.test.ts`
- Create: `lib/assessmentReport/index.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: `AssessmentIntake`, `AssessmentRoute`, `CoachingDecision`, freshness, and assessment completion metadata.
- Produces: `composeAssessmentReport(input): AssessmentReport`, containing claim keys, evidence references, confidence, and visibility.

- [ ] **Step 1: Write failing evidence, visibility, and safety tests**

```ts
it('selects one reliable free insight and keeps the plan paid', () => {
  const report = composeAssessmentReport(reportInput())
  assert.equal(report.sections.filter(section => section.visibility === 'free' && section.kind === 'insight').length, 1)
  assert.equal(report.sections.find(section => section.kind === 'training_path')?.visibility, 'paid')
})

it('never creates a numeric claim from self report', () => {
  const report = composeAssessmentReport(reportInput({ captureMode: 'self_report' }))
  assert.ok(report.sections.every(section => section.kind !== 'numeric_observation'))
})

it('returns safety-only output for stop', () => {
  const report = composeAssessmentReport(reportInput({ routeMode: 'stop' }))
  assert.equal(report.status, 'safety_hold')
  assert.ok(report.sections.every(section => section.visibility === 'free'))
})
```

- [ ] **Step 2: Verify RED**

Run: `npm test`

Expected: compile failure for missing report composer.

- [ ] **Step 3: Define a structured report model**

```ts
export interface AssessmentReportSection {
  id: string
  kind: 'body_story' | 'insight' | 'safety' | 'training_direction' | 'training_path' | 'reassessment'
  visibility: 'free' | 'paid'
  title: string
  body: string
  evidenceIds: string[]
  confidence: number | null
}

export interface AssessmentReport {
  schemaVersion: 1
  engineVersion: string
  status: 'ready' | 'insufficient_evidence' | 'safety_hold'
  generatedAt: string
  assessmentAsOf: string | null
  sections: AssessmentReportSection[]
  triggeredRuleIds: string[]
}
```

- [ ] **Step 4: Implement deterministic templates**

Build body-story copy from choice labels, select the highest-confidence allowed insight, always include safety disclosure, and create paid section titles from `focusAreas`. If no insight clears `0.70`, return `insufficient_evidence` and a retry section instead of generic praise.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all composer tests pass.

```bash
git add lib/assessmentReport tsconfig.test.json
git commit -m "feat: compose evidence-backed assessment reports"
```

---

### Task 5: Guest state and choice-first intake UI

**Files:**
- Create: `lib/assessmentIntake/guestState.ts`
- Create: `lib/assessmentIntake/guestState.test.ts`
- Create: `app/body-assessment/page.tsx`
- Create: `app/body-assessment/GuestAssessmentFlow.tsx`
- Create: `components/assessment/ChoiceCard.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: intake types and `screenAssessment()`.
- Produces: versioned `GuestAssessmentPayload` in `sessionStorage` under `forma:guest-assessment:v1`.

- [ ] **Step 1: Write serialization tests**

Test valid round-trip, expired payload rejection after 24 hours, wrong schema version rejection, and removal after successful persistence.

- [ ] **Step 2: Implement guest payload helpers**

```ts
export interface GuestAssessmentPayload {
  schemaVersion: 1
  createdAt: string
  consentVersion: '2026-07-02'
  intake: AssessmentIntake
  route: AssessmentRoute
  capture: GuestCaptureState | null
}

export const GUEST_ASSESSMENT_KEY = 'forma:guest-assessment:v1'
export function encodeGuestAssessment(payload: GuestAssessmentPayload): string
export function decodeGuestAssessment(raw: string, now?: Date): GuestAssessmentPayload | null
```

- [ ] **Step 3: Verify RED, then implement and pass tests**

Run: `npm test`

Expected after implementation: all guest-state tests pass.

- [ ] **Step 4: Build six choice screens and one safety card**

`GuestAssessmentFlow` must render one question at a time, keep `Continue` thumb-reachable, use native buttons with `aria-pressed`, allow at most two goals, use no required free-text field, and show stage labels rather than a clinical percentage. The safety screen calls `screenAssessment()` before camera initialization.

- [ ] **Step 5: Add stop and resume states**

Stop renders free conservative guidance and no checkout or subscription control. Normal exit preserves the guest payload; returning to `/body-assessment` restores the last completed step.

- [ ] **Step 6: Run checks and commit**

Run: `npm test && npm run lint`

Expected: tests and lint pass.

```bash
git add lib/assessmentIntake app/body-assessment components/assessment tsconfig.test.json
git commit -m "feat: add guest choice-first assessment intake"
```

---

### Task 6: Reuse camera assessment without persisting guest evidence early

**Files:**
- Create: `components/assessment/MovementAssessmentCapture.tsx`
- Modify: `app/assessment/BodyAssessmentFlow.tsx`
- Modify: `app/body-assessment/GuestAssessmentFlow.tsx`
- Modify: `lib/bodyAssessment/assessmentFlow.test.ts`

**Interfaces:**
- Consumes: `kind`, `constraints`, callbacks for reliable observations, camera-unavailable, low-confidence, and exit.
- Produces: no database writes; the caller owns persistence.

- [ ] **Step 1: Add a source-contract test proving capture has no Supabase dependency**

Assert that `MovementAssessmentCapture.tsx` does not import a Supabase client and exposes callback props for all outcomes.

- [ ] **Step 2: Verify RED**

Run: `npm test`

Expected: contract fails because the shared capture module does not exist.

- [ ] **Step 3: Extract camera-only behavior from `BodyAssessmentFlow`**

Use this interface:

```ts
interface MovementAssessmentCaptureProps {
  constraints: MovementConstraint[]
  onComplete(result: { observations: DerivedObservation[]; overallConfidence: number }): void
  onLowConfidence(result: { overallConfidence: number; reason: AssessmentFailureReason }): void
  onCameraUnavailable(): void
  onExit(): void
}
```

The signed-in flow keeps its existing persistence behavior by implementing these callbacks with `buildAssessmentInsert`, `buildObservationInserts`, and `buildAssessmentCompletion`. The guest flow stores only normalized observations in its session payload.

- [ ] **Step 4: Apply modified movement constraints**

Render reduced-range copy for matching movements, skip only explicit `skip_movement`, and offer the optional single-arm comparison only for a matching constraint. Stop routes never mount `PoseCamera`.

- [ ] **Step 5: Run tests, lint, and commit**

Run: `npm test && npm run lint`

Expected: signed-in assessment regression tests and new guest capture contract pass.

```bash
git add components/assessment app/assessment app/body-assessment lib/bodyAssessment/assessmentFlow.test.ts
git commit -m "refactor: share movement assessment capture"
```

---

### Task 7: First insight, authentication return, and durable transfer

**Files:**
- Create: `app/body-assessment/insight/page.tsx`
- Create: `app/body-assessment/save/page.tsx`
- Create: `app/body-assessment/save/SaveGuestAssessment.tsx`
- Create: `lib/assessmentReport/saveGuestAssessment.ts`
- Create: `lib/assessmentReport/saveGuestAssessment.test.ts`
- Modify: `app/(auth)/signup/page.tsx`
- Modify: `app/auth/callback/route.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: valid guest payload, authenticated user, report composer, and Supabase adapter.
- Produces: one idempotent durable assessment/intake/report set and destination `/body-report`.

- [ ] **Step 1: Write failing transfer tests with an in-memory adapter**

Test success, retry after report insert failure, idempotency using a client-generated transfer ID, and refusal to save stop/expired payloads as numeric observations.

- [ ] **Step 2: Implement one orchestration function**

```ts
export async function saveGuestAssessment(
  input: { userId: string; transferId: string; payload: GuestAssessmentPayload },
  adapter: GuestAssessmentPersistence,
): Promise<{ assessmentId: string; reportId: string }>
```

The adapter owns Supabase calls. The orchestration order is assessment, observations, intake version, composed report, then transfer completion marker. Repeating the same `transferId` returns the existing IDs.

- [ ] **Step 3: Build the pre-registration insight screen**

Select the highest-confidence allowed insight through `evaluateCoaching()`. Render one observation, one context link, and **Save my body starting point and view my report**. Do not render price, trial, or locked paid chapters on this screen.

- [ ] **Step 4: Preserve a safe internal return path through auth**

Add `next=/body-assessment/save` support to email signup and OAuth callback. Validate with:

```ts
function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/onboarding'
}
```

Do not accept external URLs.

- [ ] **Step 5: Build the save page**

Require authentication, decode session storage, call the orchestration function, clear guest state only after success, and route to `/body-report`. On failure keep the payload and show retry.

- [ ] **Step 6: Run checks and commit**

Run: `npm test && npm run lint`

Expected: transfer, idempotency, safe-next, and existing auth tests pass.

```bash
git add app/body-assessment app/\(auth\)/signup/page.tsx app/auth/callback/route.ts lib/assessmentReport tsconfig.test.json
git commit -m "feat: save guest assessment after signup"
```

---

### Task 8: Free report preview and personalized locked sections

**Files:**
- Create: `app/(app)/body-report/page.tsx`
- Create: `components/body-report/AssessmentReportView.tsx`
- Create: `lib/assessmentReport/loadLatestReport.ts`
- Create: `lib/assessmentReport/reportPages.test.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: latest `AssessmentReport` owned by the current user.
- Produces: a free report view and CTA to the free five-minute session; it does not generate new decisions in the UI.

- [ ] **Step 1: Write source-contract tests**

Assert that the page loads the latest report by user, free sections render before paid sections, safety status hides all upgrade controls, confidence/evidence copy exists, and the page contains no body score.

- [ ] **Step 2: Build the server loader**

Return `{ report, error }`; select only the authenticated user’s latest row ordered by `generated_at desc`. Treat no row and malformed report as recoverable states.

- [ ] **Step 3: Build the report story UI**

Render report date/freshness, body story, relative strength, priority insight, training direction, safety, and evidence disclosure. Render paid sections as personalized titles with explanatory lock treatment, not blurred fake content.

The primary CTA is **Try my first five-minute session** and links to the existing free `Desk Reset` plan resolved by ID on the server. Secondary action is **Continue with free** to `/home`.

- [ ] **Step 4: Add insufficient-evidence and safety states**

Insufficient evidence offers camera retry. Safety state provides free guidance and retake check-in; it renders no trial, checkout, or urgency language.

- [ ] **Step 5: Run checks and commit**

Run: `npm test && npm run lint && npm run build`

Expected: all checks pass and `/body-report` builds as a server page.

```bash
git add app/\(app\)/body-report components/body-report lib/assessmentReport tsconfig.test.json
git commit -m "feat: add free body report preview"
```

---

### Task 9: Free first-session entitlement and post-session trial handoff

**Files:**
- Create: `supabase/migrations/009_personalized_session_entitlement.sql`
- Create: `lib/subscriptionEntitlement.ts`
- Create: `lib/subscriptionEntitlement.test.ts`
- Modify: `app/session/[id]/page.tsx`
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Modify: `app/api/stripe/checkout/route.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: user subscription status, completed personalized free-session count, and latest report ID.
- Produces: `deriveTrainingEntitlement(input)` returning `allow_free_personalized`, `allow_subscriber`, or `require_trial`.

- [ ] **Step 1: Write entitlement tests**

Cover one free personalized session, subscriber access, second personalized attempt requiring trial, partial attempts not consuming entitlement, and safety hold blocking before entitlement evaluation.

- [ ] **Step 2: Implement pure entitlement derivation and migration**

Add `report_id` and `is_personalized_intro` to `session_records`, plus `trial_started_at timestamptz` to `user_profiles`. Add an index that supports counting completed non-partial intro sessions per user. Keep access user-scoped through existing policies. Trial eligibility is `trial_started_at is null`; the checkout transaction sets it when Stripe session creation succeeds, so a customer cannot repeatedly request a trial.

- [ ] **Step 3: Apply entitlement at the server seam**

`app/session/[id]/page.tsx` first applies `deriveSessionBodyPolicy`; `block_safety` wins. Then derive entitlement. Never rely only on hidden buttons in the client.

- [ ] **Step 4: Add post-session trial card**

After the free personalized session and body-feel response, render **Start my seven-day trial**. Pass `trial=true` through the checkout POST. Update checkout creation to apply a seven-day trial only when the authenticated customer is eligible and has not consumed a prior trial.

- [ ] **Step 5: Run checks and commit**

Run: `npm test && npm run lint && npm run build`

Expected: entitlement and checkout tests pass; build succeeds.

```bash
git add supabase/migrations/009_personalized_session_entitlement.sql lib/subscriptionEntitlement* app/session app/api/stripe/checkout/route.ts tsconfig.test.json
git commit -m "feat: add personalized intro session and trial"
```

---

### Task 10: Living-report update policy

**Files:**
- Create: `lib/livingReport/deriveReportUpdate.ts`
- Create: `lib/livingReport/deriveReportUpdate.test.ts`
- Create: `lib/livingReport/index.ts`
- Modify: `lib/bodyMirror/types.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: latest report, latest check-ins, session effects, reassessment evidence, and current time.
- Produces: `deriveReportUpdate(input): ReportUpdateDecision` without writing data.

- [ ] **Step 1: Write update-threshold tests**

Test: one daily check-in changes only today’s intensity; two consecutive worse post-session responses request regression; reliable reassessment can create a report version; sparse data creates no weekly claim; stop signal immediately returns safety hold.

- [ ] **Step 2: Define and implement the update decision**

```ts
export type ReportUpdateDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'today_only'; intensity: 'gentle' | 'standard'; reason: string }
  | { kind: 'regress_plan'; affectedFocusAreas: string[]; reason: string }
  | { kind: 'new_report_version'; basis: 'reassessment' | 'four_week_review'; reason: string }
  | { kind: 'safety_hold'; signals: SafetySignal[] }
```

Use the existing confidence threshold `0.70`, movement stale threshold, and latest-check-in safety semantics from Body Mirror rather than duplicating constants.

- [ ] **Step 3: Run tests and commit**

Run: `npm test`

Expected: all update policy tests pass.

```bash
git add lib/livingReport lib/bodyMirror/types.ts tsconfig.test.json
git commit -m "feat: add living report update policy"
```

---

### Task 11: Analytics, privacy, accessibility, and end-to-end verification

**Files:**
- Create: `lib/assessmentAnalytics.ts`
- Create: `lib/assessmentAnalytics.test.ts`
- Modify: `app/body-assessment/GuestAssessmentFlow.tsx`
- Modify: `components/body-report/AssessmentReportView.tsx`
- Modify: `app/(app)/profile/page.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: named funnel events and non-sensitive flow metadata.
- Produces: sanitized analytics events; profile links for report history, export, and deletion entry points.

- [ ] **Step 1: Write analytics sanitizer tests**

Reject keys containing `injury`, `symptom`, `notes`, `landmarks`, `video`, or free text. Allow only step name, outcome, failure category, duration bucket, confidence bucket, and experiment variant.

- [ ] **Step 2: Instrument approved funnel events**

Record entry, consent, intake complete, camera start, assessment complete, first insight, registration redirect, report preview, first session, trial start, reassessment complete, and monthly report view. Do not include answer values.

- [ ] **Step 3: Add user data controls**

Profile links to report history and provides clear entry points for export and account/data deletion using existing account-management patterns. Do not implement silent destructive deletion from a single tap; require confirmation.

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits `0` with no warnings promoted by lint.

- [ ] **Step 5: Perform browser verification in the user’s in-app browser**

At mobile viewport, verify: standard path, recovered shoulder path, safety stop, camera denial, low confidence, partial exit/resume, first insight before signup, safe auth return, save retry, free report, no-report state, first free session, trial prompt, cancellation/history access, keyboard navigation, visible focus, screen-reader labels, selected states, contrast, and reduced motion.

- [ ] **Step 6: Commit verification and analytics changes**

```bash
git add lib/assessmentAnalytics* app/body-assessment components/body-report app/\(app\)/profile/page.tsx tsconfig.test.json
git commit -m "feat: verify assessment conversion funnel"
```

## Final acceptance checklist

- [ ] A guest reaches a specific evidence-backed insight without creating an account.
- [ ] Registration safely transfers the guest payload exactly once.
- [ ] Stop state never opens camera or shows subscription UI.
- [ ] Free report contains a real insight, safety, evidence disclosure, and personalized locked plan titles.
- [ ] The first personalized five-minute session works without payment details.
- [ ] Trial starts only after the free session and is enforced server-side.
- [ ] Every coaching decision contains engine version, triggered rule IDs, and evidence IDs.
- [ ] No large-model call is required for Stage A or B; deterministic templates are the source of visible claims.
- [ ] All automated and browser checks pass before deployment.

## Follow-up plan boundary

This plan establishes the update decision module but intentionally does not add scheduled weekly/monthly job infrastructure, push-notification delivery, or large-model prose generation. Those should receive separate implementation plans after the Stage B funnel is measured and the deterministic claims are professionally reviewed.
