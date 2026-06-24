# Exercise Library Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seeded exercise library with the new 30-exercise Pilates set, rebuild the seven existing session plans, and tune camera tracking profiles for the new actions.

**Architecture:** Add one forward SQL migration for the data replacement and keep the current `exercises` table contract intact. Store expanded exercise metrics in `pose_definition` JSON for this pass, and keep app tracking configuration in `lib/exerciseTracking.ts` with explicit profiles for all new display names.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Supabase/PostgreSQL migrations, MediaPipe landmark indices.

## Global Constraints

- Keep the seven existing plan names: `Spinal Mobility & Deep Core`, `Shoulder & Neck Release`, `Core Activation`, `Evening Wind-Down`, `Hip Flexor & Lower Back Flow`, `Full Body Pilates - Moderate`, `Postnatal Foundation`.
- Do not reintroduce `Postnatal Recovery - Week 1` or `Postnatal Recovery — Week 1`.
- Use normalized workbook exercise names as app-facing exercise names.
- Do not delete historical user `session_records`.
- Do not normalize metrics into new database tables in this pass.
- Use TDD for TypeScript behavior and seed validation changes.
- Do not stage or commit `outputs/` workbook artifacts unless the user explicitly asks.

---

## File Structure

- Modify `lib/sessionPlansSeed.test.ts`: expand seed validation to cover the new migration, all 30 exercise names, and seven plan references.
- Modify `tsconfig.test.json`: already includes `lib/sessionPlansSeed.test.ts`; no further change expected unless new test files are added.
- Create `supabase/migrations/006_replace_exercise_library.sql`: forward migration that upserts the 30 normalized exercises and rebuilds the seven seeded plan queues.
- Modify `lib/exerciseTracking.test.ts`: add behavior tests for the 30 new tracking profiles.
- Modify `lib/exerciseTracking.ts`: replace legacy profile overrides and floor set with explicit profile groups and per-exercise overrides for the new library.

---

### Task 1: Add Seed Validation Tests For The Replacement Migration

**Files:**
- Modify: `lib/sessionPlansSeed.test.ts`
- Read: `docs/superpowers/specs/2026-06-23-exercise-library-replacement-design.md`
- Future dependency: `supabase/migrations/006_replace_exercise_library.sql`

**Interfaces:**
- Consumes: SQL text from `supabase/migrations/006_replace_exercise_library.sql`.
- Produces: test expectations for `NEW_EXERCISE_NAMES`, `PLAN_NAMES`, and migration plan references.

- [ ] **Step 1: Write the failing test**

Replace `lib/sessionPlansSeed.test.ts` with:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const replacementSeedPath = 'supabase/migrations/006_replace_exercise_library.sql'

const NEW_EXERCISE_NAMES = [
  'Chest Lift',
  'Glute Bridge',
  'Dead Bug',
  'Femur Arcs',
  'Bent Knee Opening',
  'Supine Knee Sways',
  'Arm Arcs',
  'Assisted Roll Up',
  'Roll Up',
  'Side Kick',
  'Prone Press Up',
  'Book Opening',
  'Spine Stretch Forward',
  'Hundred Prep',
  'Mermaid Stretch',
  'Quadruped Rock Back',
  'Leg Pull Front Prep',
  'Standing Roll Down',
  'Swan',
  'Spine Twist',
  'Single Leg Kick',
  'Saw',
  'Leg Pull Back',
  'Side Lift',
  'Single Leg Stretch',
  'Criss Cross',
  'Single Leg Circle',
  'Double Leg Kick',
  'Double Leg Stretch',
  'Pilates Push Up',
] as const

const PLAN_NAMES = [
  'Spinal Mobility & Deep Core',
  'Shoulder & Neck Release',
  'Core Activation',
  'Evening Wind-Down',
  'Hip Flexor & Lower Back Flow',
  'Full Body Pilates - Moderate',
  'Postnatal Foundation',
] as const

function readReplacementSeed() {
  return readFileSync(replacementSeedPath, 'utf8')
}

function sqlStringPattern(value: string) {
  return new RegExp(`'${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll("'", "''")}'`)
}

describe('session plan seed names', () => {
  it('uses a non-series name for the postnatal foundation plan', () => {
    const fullSetup = readFileSync('supabase/migrations/000_full_setup.sql', 'utf8')
    const exerciseSeed = readFileSync('supabase/migrations/002_seed_exercises.sql', 'utf8')
    const replacementSeed = readReplacementSeed()

    assert.match(fullSetup, /Postnatal Foundation/)
    assert.match(exerciseSeed, /Postnatal Foundation/)
    assert.match(replacementSeed, /Postnatal Foundation/)
    assert.doesNotMatch(fullSetup, /Postnatal Recovery [—-] Week 1/)
    assert.doesNotMatch(exerciseSeed, /Postnatal Recovery [—-] Week 1/)
    assert.doesNotMatch(replacementSeed, /Postnatal Recovery [—-] Week 1/)
  })

  it('seeds every normalized replacement exercise name', () => {
    const replacementSeed = readReplacementSeed()

    for (const exerciseName of NEW_EXERCISE_NAMES) {
      assert.match(replacementSeed, sqlStringPattern(exerciseName), `${exerciseName} missing from replacement migration`)
    }
  })

  it('rebuilds all existing session plans from replacement exercises only', () => {
    const replacementSeed = readReplacementSeed()

    for (const planName of PLAN_NAMES) {
      assert.match(replacementSeed, sqlStringPattern(planName), `${planName} missing from replacement migration`)
    }

    assert.doesNotMatch(replacementSeed, /Cat-Cow Stretch|Pelvic Tilts|Child''s Pose Hold|Plank Hold|Teaser Prep/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `supabase/migrations/006_replace_exercise_library.sql` does not exist yet.

- [ ] **Step 3: Commit is not allowed in this task**

Do not commit after a red test. Continue to Task 2.

---

### Task 2: Add The Forward Replacement Migration

**Files:**
- Create: `supabase/migrations/006_replace_exercise_library.sql`
- Test: `lib/sessionPlansSeed.test.ts`

**Interfaces:**
- Consumes: `NEW_EXERCISE_NAMES` and `PLAN_NAMES` from Task 1 expectations.
- Produces: SQL migration with all 30 exercises and seven plan queues.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/006_replace_exercise_library.sql` with this structure:

```sql
-- Forma - replace exercise library with 30 optimized Pilates actions

create unique index if not exists exercises_name_key on public.exercises (name);
create unique index if not exists session_plans_name_key on public.session_plans (name);

update public.session_plans
set name = 'Postnatal Foundation'
where name = 'Postnatal Recovery — Week 1'
   or name = 'Postnatal Recovery - Week 1';

with replacement_exercises(name, description, instructions, target_muscles, category, difficulty, duration_type, default_reps, pose_definition, is_pro) as (
  values
  ('Chest Lift',
   'Supine abdominal curl with ribs sliding toward pelvis.',
   ARRAY['Lie supine, knees bent, hands behind head','Exhale and curl head and shoulders just off the mat','Keep pelvis heavy and neck long','Inhale to lower with control']::text[],
   ARRAY['rectus abdominis','transverse abdominis','neck flexor endurance']::text[],
   'core', 'gentle', 'reps', 8,
   '{"key_angles":[],"alignment_cues":[],"common_mistakes":["pulling neck","rib flare","pelvis tucking excessively"],"tracking":{"mode":"auto_rep","camera_view":"side","camera_orientation":"landscape preferred","captureability_score":4},"sequencing":{"start_position":"supine","support_base":"large","mat_contact_score":5,"preferred_sequence_stage":"activation"},"goal_scores":{"deep_core":75,"waist_abdominal":80,"lower_back_support":55},"safety":{"pain_sensitive_regions":["neck","low back"],"stop_conditions":["sharp pain","dizziness","numbness"]}}'::jsonb,
   false)
)
insert into public.exercises
  (name, description, instructions, target_muscles, category, difficulty, duration_type, default_reps, pose_definition, is_pro)
select name, description, instructions, target_muscles, category, difficulty, duration_type, default_reps, pose_definition, is_pro
from replacement_exercises
on conflict (name) do update
set description = excluded.description,
    instructions = excluded.instructions,
    target_muscles = excluded.target_muscles,
    category = excluded.category,
    difficulty = excluded.difficulty,
    duration_type = excluded.duration_type,
    default_reps = excluded.default_reps,
    pose_definition = excluded.pose_definition,
    is_pro = excluded.is_pro;

delete from public.session_plan_exercises spe
using public.session_plans sp
where spe.session_plan_id = sp.id
  and sp.name in (
    'Spinal Mobility & Deep Core',
    'Shoulder & Neck Release',
    'Core Activation',
    'Evening Wind-Down',
    'Hip Flexor & Lower Back Flow',
    'Full Body Pilates - Moderate',
    'Postnatal Foundation'
  );

with plan_exercises(plan_name, exercise_name, order_index, reps_override, rest_after_seconds) as (
  values
  ('Spinal Mobility & Deep Core', 'Supine Knee Sways', 0, 8, 15),
  ('Spinal Mobility & Deep Core', 'Chest Lift', 1, 8, 15),
  ('Spinal Mobility & Deep Core', 'Dead Bug', 2, 8, 20),
  ('Spinal Mobility & Deep Core', 'Book Opening', 3, 6, 15),
  ('Spinal Mobility & Deep Core', 'Spine Stretch Forward', 4, 6, 15),
  ('Spinal Mobility & Deep Core', 'Quadruped Rock Back', 5, 8, 20),
  ('Spinal Mobility & Deep Core', 'Mermaid Stretch', 6, 6, 15),

  ('Shoulder & Neck Release', 'Arm Arcs', 0, 8, 15),
  ('Shoulder & Neck Release', 'Book Opening', 1, 6, 15),
  ('Shoulder & Neck Release', 'Prone Press Up', 2, 8, 20),
  ('Shoulder & Neck Release', 'Mermaid Stretch', 3, 6, 15),
  ('Shoulder & Neck Release', 'Spine Twist', 4, 8, 15),
  ('Shoulder & Neck Release', 'Standing Roll Down', 5, 5, 20),

  ('Core Activation', 'Chest Lift', 0, 8, 15),
  ('Core Activation', 'Femur Arcs', 1, 8, 15),
  ('Core Activation', 'Dead Bug', 2, 8, 20),
  ('Core Activation', 'Hundred Prep', 3, 30, 20),
  ('Core Activation', 'Single Leg Stretch', 4, 10, 20),
  ('Core Activation', 'Double Leg Stretch', 5, 8, 25),

  ('Evening Wind-Down', 'Supine Knee Sways', 0, 8, 15),
  ('Evening Wind-Down', 'Bent Knee Opening', 1, 8, 15),
  ('Evening Wind-Down', 'Book Opening', 2, 6, 15),
  ('Evening Wind-Down', 'Spine Stretch Forward', 3, 6, 15),
  ('Evening Wind-Down', 'Mermaid Stretch', 4, 6, 15),
  ('Evening Wind-Down', 'Arm Arcs', 5, 8, 15),

  ('Hip Flexor & Lower Back Flow', 'Bent Knee Opening', 0, 8, 15),
  ('Hip Flexor & Lower Back Flow', 'Glute Bridge', 1, 10, 20),
  ('Hip Flexor & Lower Back Flow', 'Side Kick', 2, 8, 20),
  ('Hip Flexor & Lower Back Flow', 'Single Leg Circle', 3, 6, 20),
  ('Hip Flexor & Lower Back Flow', 'Quadruped Rock Back', 4, 8, 20),
  ('Hip Flexor & Lower Back Flow', 'Standing Roll Down', 5, 5, 20),

  ('Full Body Pilates - Moderate', 'Arm Arcs', 0, 8, 15),
  ('Full Body Pilates - Moderate', 'Glute Bridge', 1, 10, 20),
  ('Full Body Pilates - Moderate', 'Hundred Prep', 2, 30, 20),
  ('Full Body Pilates - Moderate', 'Roll Up', 3, 6, 25),
  ('Full Body Pilates - Moderate', 'Swan', 4, 6, 25),
  ('Full Body Pilates - Moderate', 'Single Leg Stretch', 5, 10, 20),
  ('Full Body Pilates - Moderate', 'Leg Pull Front Prep', 6, 6, 30),
  ('Full Body Pilates - Moderate', 'Pilates Push Up', 7, 5, 30),
  ('Full Body Pilates - Moderate', 'Mermaid Stretch', 8, 6, 15),

  ('Postnatal Foundation', 'Arm Arcs', 0, 8, 15),
  ('Postnatal Foundation', 'Bent Knee Opening', 1, 8, 15),
  ('Postnatal Foundation', 'Chest Lift', 2, 6, 20),
  ('Postnatal Foundation', 'Femur Arcs', 3, 6, 20),
  ('Postnatal Foundation', 'Glute Bridge', 4, 8, 20),
  ('Postnatal Foundation', 'Book Opening', 5, 6, 15)
)
insert into public.session_plan_exercises (session_plan_id, exercise_id, order_index, reps_override, rest_after_seconds)
select sp.id, ex.id, pe.order_index, pe.reps_override, pe.rest_after_seconds
from plan_exercises pe
join public.session_plans sp on sp.name = pe.plan_name
join public.exercises ex on ex.name = pe.exercise_name
on conflict (session_plan_id, order_index) do update
set exercise_id = excluded.exercise_id,
    reps_override = excluded.reps_override,
    rest_after_seconds = excluded.rest_after_seconds;

notify pgrst, 'reload schema';
```

Replace the single example row in the SQL scaffold with concrete rows for exactly these 30 normalized names:

```text
Chest Lift
Glute Bridge
Dead Bug
Femur Arcs
Bent Knee Opening
Supine Knee Sways
Arm Arcs
Assisted Roll Up
Roll Up
Side Kick
Prone Press Up
Book Opening
Spine Stretch Forward
Hundred Prep
Mermaid Stretch
Quadruped Rock Back
Leg Pull Front Prep
Standing Roll Down
Swan
Spine Twist
Single Leg Kick
Saw
Leg Pull Back
Side Lift
Single Leg Stretch
Criss Cross
Single Leg Circle
Double Leg Kick
Double Leg Stretch
Pilates Push Up
```

Implementation rules for the 30 `replacement_exercises` rows:

- Use the workbook-generated descriptions/instructions as the source.
- Map `duration_type = timed` from the workbook to current table value `hold`, because the current schema only allows `reps` or `hold`.
- Put actual seconds into `default_reps` for hold/timed exercises.
- Map difficulty level 1-2 to `gentle`, 3 to `moderate`, 4-5 to `challenging`.
- Map category from goal emphasis: core, spine, hips, shoulders, full_body, cool_down.
- Use `is_pro = true` for advanced/full-body peak exercises: `Leg Pull Back`, `Side Lift`, `Criss Cross`, `Double Leg Kick`, `Double Leg Stretch`, `Pilates Push Up`.

- [ ] **Step 2: Run seed tests to verify they pass**

Run:

```bash
npm test
```

Expected: PASS for `session plan seed names`.

- [ ] **Step 3: Commit Task 1 and Task 2**

Run:

```bash
git add lib/sessionPlansSeed.test.ts supabase/migrations/006_replace_exercise_library.sql
git commit -m "feat: replace seeded exercise library"
```

---

### Task 3: Add Tracking Profile Tests For The New 30 Exercises

**Files:**
- Modify: `lib/exerciseTracking.test.ts`
- Test: `lib/exerciseTracking.ts`

**Interfaces:**
- Consumes: `getExerciseTrackingProfile(exerciseName, isFloorExercise, durationType)`.
- Produces: expected behavior for all new exercise names.

- [ ] **Step 1: Write the failing tests**

Append to `lib/exerciseTracking.test.ts`:

```ts
const NEW_EXERCISE_NAMES = [
  'Chest Lift',
  'Glute Bridge',
  'Dead Bug',
  'Femur Arcs',
  'Bent Knee Opening',
  'Supine Knee Sways',
  'Arm Arcs',
  'Assisted Roll Up',
  'Roll Up',
  'Side Kick',
  'Prone Press Up',
  'Book Opening',
  'Spine Stretch Forward',
  'Hundred Prep',
  'Mermaid Stretch',
  'Quadruped Rock Back',
  'Leg Pull Front Prep',
  'Standing Roll Down',
  'Swan',
  'Spine Twist',
  'Single Leg Kick',
  'Saw',
  'Leg Pull Back',
  'Side Lift',
  'Single Leg Stretch',
  'Criss Cross',
  'Single Leg Circle',
  'Double Leg Kick',
  'Double Leg Stretch',
  'Pilates Push Up',
] as const

describe('replacement exercise tracking profiles', () => {
  it('has an explicit profile for every replacement exercise', () => {
    for (const exerciseName of NEW_EXERCISE_NAMES) {
      const profile = getExerciseTrackingProfile(exerciseName, true, 'reps')

      assert.ok(profile.landmarks.length > 0, `${exerciseName} should define landmarks`)
      assert.ok(profile.engageThreshold > profile.returnThreshold, `${exerciseName} should have usable thresholds`)
    }
  })

  it('uses stricter coverage for full-body peak actions', () => {
    for (const exerciseName of ['Leg Pull Front Prep', 'Leg Pull Back', 'Pilates Push Up']) {
      const profile = getExerciseTrackingProfile(exerciseName, false, 'reps')

      assert.equal(profile.cameraOrientation, 'landscape')
      assert.ok(profile.minVisibleRatio >= 0.7)
      assert.ok(profile.minVisibleLandmarks >= 6)
    }
  })

  it('keeps small floor movements tolerant enough to acquire tracking', () => {
    for (const exerciseName of ['Chest Lift', 'Femur Arcs', 'Bent Knee Opening']) {
      const profile = getExerciseTrackingProfile(exerciseName, true, 'reps')

      assert.equal(profile.cameraOrientation, 'landscape')
      assert.ok(profile.minVisibleRatio <= 0.6)
      assert.ok(profile.engageThreshold <= 0.14)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because most new names currently use only generic fallback behavior.

- [ ] **Step 3: Do not commit after red**

Continue to Task 4.

---

### Task 4: Implement Explicit Tracking Profiles For The New Library

**Files:**
- Modify: `lib/exerciseTracking.ts`
- Test: `lib/exerciseTracking.test.ts`

**Interfaces:**
- Produces: no new public API; preserves `getExerciseTrackingProfile(...)` and `FLOOR_EXERCISE_NAMES`.
- Preserves: `getExerciseTrackingProfile(...)`, `FLOOR_EXERCISE_NAMES`.

- [ ] **Step 1: Refactor profile groups**

In `lib/exerciseTracking.ts`, keep the public types and replace the profile constants with named groups:

```ts
const SUPINE_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28]
const SIDE_LYING_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28]
const PRONE_LANDMARKS = [0, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28]
const SEATED_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26]
const QUADRUPED_LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
const STANDING_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

const SUPINE_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: SUPINE_LANDMARKS,
  minVisibility: 0.32,
  minVisibleRatio: 0.55,
  minVisibleLandmarks: 5,
  confidenceThreshold: 0.3,
  engageThreshold: 0.13,
  returnThreshold: 0.055,
  trackingGraceMs: 2_000,
  cameraOrientation: 'landscape',
}

const SIDE_LYING_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: SIDE_LYING_LANDMARKS,
  minVisibility: 0.3,
  minVisibleRatio: 0.55,
  minVisibleLandmarks: 5,
  confidenceThreshold: 0.3,
  engageThreshold: 0.14,
  returnThreshold: 0.055,
  trackingGraceMs: 2_000,
  cameraOrientation: 'landscape',
}

const PRONE_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: PRONE_LANDMARKS,
  minVisibility: 0.32,
  minVisibleRatio: 0.58,
  minVisibleLandmarks: 6,
  confidenceThreshold: 0.3,
  engageThreshold: 0.14,
  returnThreshold: 0.055,
  trackingGraceMs: 2_000,
  cameraOrientation: 'landscape',
}

const SEATED_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: SEATED_LANDMARKS,
  minVisibility: 0.38,
  minVisibleRatio: 0.62,
  minVisibleLandmarks: 6,
  confidenceThreshold: 0.38,
  engageThreshold: 0.15,
  returnThreshold: 0.06,
  trackingGraceMs: 1_800,
  cameraOrientation: 'either',
}

const QUADRUPED_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: QUADRUPED_LANDMARKS,
  minVisibility: 0.32,
  minVisibleRatio: 0.58,
  minVisibleLandmarks: 6,
  confidenceThreshold: 0.32,
  engageThreshold: 0.14,
  returnThreshold: 0.055,
  trackingGraceMs: 2_000,
  cameraOrientation: 'landscape',
}

const STANDING_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: STANDING_LANDMARKS,
  minVisibility: 0.45,
  minVisibleRatio: 0.72,
  minVisibleLandmarks: 8,
  confidenceThreshold: 0.45,
  engageThreshold: 0.2,
  returnThreshold: 0.08,
  trackingGraceMs: 1_500,
  cameraOrientation: 'either',
}

const FULL_BODY_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: STANDING_LANDMARKS,
  minVisibility: 0.42,
  minVisibleRatio: 0.72,
  minVisibleLandmarks: 8,
  confidenceThreshold: 0.42,
  engageThreshold: 0.18,
  returnThreshold: 0.07,
  trackingGraceMs: 1_800,
  cameraOrientation: 'landscape',
}
```

- [ ] **Step 2: Add explicit overrides**

Replace `PROFILE_OVERRIDES` with a complete map covering all 30 names:

```ts
const PROFILE_OVERRIDES: Record<string, Partial<ExerciseTrackingProfile>> = {
  'Chest Lift': { ...SUPINE_PROFILE, engageThreshold: 0.12, returnThreshold: 0.05 },
  'Glute Bridge': { ...SUPINE_PROFILE, engageThreshold: 0.16, returnThreshold: 0.065 },
  'Dead Bug': { ...SUPINE_PROFILE, landmarks: [11, 12, 15, 16, 23, 24, 25, 26, 27, 28], engageThreshold: 0.13, returnThreshold: 0.055 },
  'Femur Arcs': { ...SUPINE_PROFILE, landmarks: [23, 24, 25, 26, 27, 28], minVisibleLandmarks: 4, engageThreshold: 0.11, returnThreshold: 0.045 },
  'Bent Knee Opening': { ...SUPINE_PROFILE, landmarks: [23, 24, 25, 26, 27, 28], minVisibleLandmarks: 4, engageThreshold: 0.1, returnThreshold: 0.04 },
  'Supine Knee Sways': { ...SUPINE_PROFILE, engageThreshold: 0.13, returnThreshold: 0.055 },
  'Arm Arcs': { ...SUPINE_PROFILE, landmarks: [11, 12, 13, 14, 15, 16, 23, 24], minVisibleLandmarks: 5, engageThreshold: 0.12, returnThreshold: 0.05 },
  'Assisted Roll Up': { ...SUPINE_PROFILE, landmarks: STANDING_LANDMARKS, minVisibleRatio: 0.65, minVisibleLandmarks: 7, engageThreshold: 0.18, returnThreshold: 0.075 },
  'Roll Up': { ...SUPINE_PROFILE, landmarks: STANDING_LANDMARKS, minVisibleRatio: 0.68, minVisibleLandmarks: 7, engageThreshold: 0.2, returnThreshold: 0.08 },
  'Side Kick': { ...SIDE_LYING_PROFILE, engageThreshold: 0.14, returnThreshold: 0.055 },
  'Prone Press Up': { ...PRONE_PROFILE, engageThreshold: 0.12, returnThreshold: 0.05 },
  'Book Opening': { ...SIDE_LYING_PROFILE, landmarks: [11, 12, 15, 16, 23, 24, 25, 26], engageThreshold: 0.14, returnThreshold: 0.055 },
  'Spine Stretch Forward': { ...SEATED_PROFILE, cameraOrientation: 'either', engageThreshold: 0.16, returnThreshold: 0.065 },
  'Hundred Prep': { ...SUPINE_PROFILE, mode: 'manual' },
  'Mermaid Stretch': { ...SEATED_PROFILE, cameraOrientation: 'either', engageThreshold: 0.13, returnThreshold: 0.055 },
  'Quadruped Rock Back': { ...QUADRUPED_PROFILE, engageThreshold: 0.14, returnThreshold: 0.055 },
  'Leg Pull Front Prep': { ...FULL_BODY_PROFILE, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Standing Roll Down': { ...STANDING_PROFILE, cameraOrientation: 'either', engageThreshold: 0.2, returnThreshold: 0.08 },
  'Swan': { ...PRONE_PROFILE, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Spine Twist': { ...SEATED_PROFILE, cameraOrientation: 'front', engageThreshold: 0.12, returnThreshold: 0.05 },
  'Single Leg Kick': { ...PRONE_PROFILE, engageThreshold: 0.13, returnThreshold: 0.055 },
  'Saw': { ...SEATED_PROFILE, cameraOrientation: 'front', minVisibleRatio: 0.62, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Leg Pull Back': { ...FULL_BODY_PROFILE, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Side Lift': { ...FULL_BODY_PROFILE, landmarks: SIDE_LYING_LANDMARKS, minVisibleRatio: 0.7, minVisibleLandmarks: 6, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Single Leg Stretch': { ...SUPINE_PROFILE, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Criss Cross': { ...SUPINE_PROFILE, landmarks: [11, 12, 13, 14, 23, 24, 25, 26, 27, 28], minVisibleRatio: 0.6, engageThreshold: 0.14, returnThreshold: 0.055 },
  'Single Leg Circle': { ...SUPINE_PROFILE, landmarks: [23, 24, 25, 26, 27, 28], minVisibleLandmarks: 4, engageThreshold: 0.13, returnThreshold: 0.05 },
  'Double Leg Kick': { ...PRONE_PROFILE, minVisibleRatio: 0.65, minVisibleLandmarks: 7, engageThreshold: 0.16, returnThreshold: 0.065 },
  'Double Leg Stretch': { ...SUPINE_PROFILE, landmarks: STANDING_LANDMARKS, minVisibleRatio: 0.65, minVisibleLandmarks: 7, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Pilates Push Up': { ...FULL_BODY_PROFILE, engageThreshold: 0.2, returnThreshold: 0.08 },
}
```

- [ ] **Step 3: Update floor exercise set**

Set `FLOOR_EXERCISE_NAMES` to include all supine, prone, side-lying, seated, quadruped, and plank mat movements. Exclude only `Standing Roll Down` if it should use standing framing.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3 and Task 4**

Run:

```bash
git add lib/exerciseTracking.ts lib/exerciseTracking.test.ts
git commit -m "feat: tune tracking for replacement exercises"
```

---

### Task 5: Final Verification And Publish

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: commits from Tasks 1-4.
- Produces: verified branch ready to push.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0 with no warnings.

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected: exits 0.

- [ ] **Step 3: Run production build with dummy environment**

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy STRIPE_PRO_YEARLY_PRICE_ID=price_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
```

Expected: exits 0.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: branch may be ahead of `origin/master`; `outputs/` may remain untracked and must not be staged.

- [ ] **Step 5: Push after user approval**

Run:

```bash
git push origin master
```

Expected: `master -> master`.
