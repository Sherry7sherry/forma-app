# Exercise Library Replacement Design

## Goal

Replace the existing seeded exercise library with the new 30-exercise Pilates library from `30_exercises_completed_metrics.xlsx`, then rebuild the existing seven session plans so they are easier to capture, better sequenced, and more aligned with user goals.

## Scope

This change replaces the exercise content used by seeded plans. It does not create new plan names beyond the existing seven:

- Spinal Mobility & Deep Core
- Shoulder & Neck Release
- Core Activation
- Evening Wind-Down
- Hip Flexor & Lower Back Flow
- Full Body Pilates - Moderate
- Postnatal Foundation

The seventh plan must remain `Postnatal Foundation`, not `Postnatal Recovery - Week 1`.

## Data Strategy

Add a new forward migration, `supabase/migrations/006_replace_exercise_library.sql`, instead of rewriting historical migrations again. The migration will:

- Insert or update the new 30 exercises by `name`.
- Rebuild seeded `session_plan_exercises` links for the seven existing plans.
- Keep existing user session records untouched.
- Use the current `exercises` table shape for compatibility.
- Store extended metrics in `pose_definition` JSON for now.

The JSON stored in `pose_definition` will include the existing keys expected by the app plus production metrics needed for tracking and planning:

- `key_angles`
- `alignment_cues`
- `common_mistakes`
- `tracking`
- `sequencing`
- `goal_scores`
- `safety`

This keeps the first implementation deployable without a large database normalization pass. A later production hardening pass can split this JSON into `exercise_tracking_profiles`, `exercise_goal_weights`, and `exercise_safety_rules`.

## Exercise Replacement

The source of truth is the generated workbook:

`/Users/bytedance/Documents/forma/outputs/exercise_metrics_work/30_exercises_completed_metrics.xlsx`

The app-facing exercise names should use the workbook `normalized_name` values. The original source names remain useful for auditing but should not appear as display names where they contain typos or informal phrasing.

Examples:

- `bridging` becomes `Glute Bridge`
- `hundred` becomes `Hundred Prep`
- `sing leg kick` becomes `Single Leg Kick`
- `push up` becomes `Pilates Push Up`

The seed should not include the old exercise set in the rebuilt plan links.

## Session Plan Sequencing

Each plan should move from more supported positions to smaller support and fuller integration:

1. Supine or prone low-load setup
2. Side-lying or seated mobility/control
3. Quadruped or plank preparation
4. Standing or full-body integration where appropriate
5. Cooldown or downshift where appropriate

Plan content should prioritize the plan goal:

- Spinal Mobility & Deep Core: spine mobility, deep core, low-back support
- Shoulder & Neck Release: thoracic/shoulder mobility and posture
- Core Activation: deep core, waist/abdominal control, low-back support
- Evening Wind-Down: recovery, relaxation, low-load spine/hip mobility
- Hip Flexor & Lower Back Flow: hip mobility, glute activation, low-back support
- Full Body Pilates - Moderate: integrated core, glutes, spine, and full-body control
- Postnatal Foundation: breath, gentle core, pelvic/spinal control, glute activation

## Tracking Design

Update `lib/exerciseTracking.ts` so all new 30 exercise names return an explicit tracking profile.

Profiles should be grouped by position and then overridden by movement:

- Supine: tolerant floor profile, side or front view, partial lower-body occlusion allowed
- Prone: floor profile, side view, torso/hip/knee landmarks prioritized
- Side-lying: tolerant profile, hip/knee/ankle landmarks prioritized
- Seated: medium tolerance, front or side view depending on rotation/flexion
- Quadruped: landscape, side view, shoulder/hip/knee/wrist landmarks
- Standing: full-body profile, side or front view, higher visible ratio
- Plank/full-body: strict profile, landscape required, full-body required

Manual or timed counting should be used when a movement is too subtle for reliable camera rep counting. The implementation should prefer avoiding false confidence over forcing auto-counting for small internal movements.

## Runtime Behavior

The existing generic rep detector will remain the first implementation path. It will still use normalized pose distance with per-exercise thresholds. This avoids a large movement-specific state-machine rewrite in the same change.

The new profiles should improve capture by:

- lowering thresholds for small but visible mat movements
- requiring landscape for floor/full-body movements
- marking subtle holds or internal activation as manual or timed
- using landmark sets that match the body parts that actually move

## Tests

Add or update tests to verify:

- every new exercise name has an explicit tracking profile
- subtle/internal exercises are manual or timed, not generic auto reps
- full-body/plank/standing exercises require stronger coverage
- the seven seeded session plans only reference new exercise names
- `Postnatal Recovery - Week 1` does not reappear
- the migration contains all 30 normalized exercise names

## Non-Goals

- Do not build a full admin UI for editing exercises.
- Do not normalize all exercise metrics into new tables in this pass.
- Do not replace the pose engine or introduce per-exercise geometric state machines yet.
- Do not delete historical user session records.
