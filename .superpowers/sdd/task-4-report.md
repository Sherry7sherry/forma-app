STATUS
- Complete

Files changed
- `lib/exerciseTracking.ts`
- `lib/exerciseTracking.test.ts`

Commit hash
- `0c0e26e`

Test command and result summary
- Command: `npm test`
- Result: pass
- Summary: 22 tests passed, 0 failed, 9 suites passed

How all 30 exercises are covered
- Supine: `Chest Lift`, `Glute Bridge`, `Dead Bug`, `Femur Arcs`, `Bent Knee Opening`, `Supine Knee Sways`, `Arm Arcs`, `Assisted Roll Up`, `Roll Up`, `Hundred Prep`, `Single Leg Stretch`, `Criss Cross`, `Single Leg Circle`, `Double Leg Stretch`
- Side-lying: `Side Kick`, `Book Opening`, `Side Lift`
- Prone: `Prone Press Up`, `Swan`, `Single Leg Kick`, `Double Leg Kick`
- Seated: `Spine Stretch Forward`, `Mermaid Stretch`, `Spine Twist`, `Saw`
- Quadruped: `Quadruped Rock Back`
- Full-body / plank: `Leg Pull Front Prep`, `Leg Pull Back`, `Pilates Push Up`
- Standing: `Standing Roll Down`
- Coverage implementation details:
  - Added explicit `PROFILE_OVERRIDES` entries for each of the 30 replacement exercise names.
  - Refactored the shared tracking defaults into named posture groups: supine, side-lying, prone, seated, quadruped, standing, and full-body.
  - Updated `FLOOR_EXERCISE_NAMES` to include the new mat exercises and exclude `Standing Roll Down`.

Self-review notes
- Preserved the public exports `getExerciseTrackingProfile(...)` and `FLOOR_EXERCISE_NAMES`.
- Kept changes scoped to the owned implementation file and the existing Task 3 test file.
- Mapped the brief's front-facing seated cases onto the existing public `CameraOrientation` enum using `portrait`, since the public type does not expose `front`.
- Did not modify SQL migrations, seed tests, or stage `outputs/`.

FIX STATUS
- Complete

Files changed
- `lib/exerciseTracking.ts`
- `lib/exerciseTracking.test.ts`

Commit hash
- `29e0bd7`

Test command and result summary
- Command: `npm test`
- Result: pass
- Summary: 24 tests passed, 0 failed, 9 suites passed

How each review finding was addressed
- Finding 1: Updated seated front-view overrides so `Spine Twist` and `Saw` use `cameraOrientation: 'either'` instead of `portrait`, matching the codebase meaning of physical device orientation.
- Finding 2: Added public export `EXPLICIT_EXERCISE_PROFILE_NAMES` from `lib/exerciseTracking.ts`, then updated tests to assert all 30 replacement names are explicitly overridden, to verify `Spine Twist` and `Saw` do not require portrait, and to confirm `Standing Roll Down` is excluded from `FLOOR_EXERCISE_NAMES` while using the standing profile when `isFloorExercise=false`.
