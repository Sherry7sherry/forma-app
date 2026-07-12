import {
  getExerciseTrackingOverrideNames,
  getExerciseTrackingProfile,
  getFloorExerciseNames,
} from '@/lib/exerciseTracking'
import type {
  AssessmentTestableMovement,
  ExerciseTestableMovement,
  PostureFamily,
  TestScenarioDefinition,
  TestableMovement,
} from '@/lib/internalTesting/types'

const CAMERA_SCENARIO: TestScenarioDefinition = {
  id: 'camera-unavailable',
  label: 'Camera unavailable',
  assertionType: 'camera-lifecycle',
}
const CALIBRATION_SCENARIO: TestScenarioDefinition = {
  id: 'calibration-blocked',
  label: 'Calibration blocked',
  assertionType: 'calibration',
}

export const ASSESSMENT_TEST_MOVEMENTS: readonly AssessmentTestableMovement[] = Object.freeze([
  {
    id: 'assessment:side_arm_raise',
    kind: 'assessment',
    assessmentMovementKey: 'side_arm_raise',
    displayName: 'Arm Arcs',
    exerciseName: 'Arm Arcs',
    postureFamily: 'standing',
    trackingMode: 'manual',
    orientation: 'either',
    capabilities: ['calibration', 'assessment-observation'],
    scenarios: [CAMERA_SCENARIO, CALIBRATION_SCENARIO, { id: 'low-confidence', label: 'Low confidence', assertionType: 'assessment-evidence' }],
    title: 'Standing arm raise',
    view: 'Side view',
    instruction: 'Stand side-on with your whole body visible, arms relaxed by your sides.',
    cue: 'Slowly raise both arms overhead, then lower them twice.',
  },
  {
    id: 'assessment:standing_roll_down',
    kind: 'assessment',
    assessmentMovementKey: 'standing_roll_down',
    displayName: 'Standing Roll Down',
    exerciseName: 'Standing Roll Down',
    postureFamily: 'standing',
    trackingMode: 'manual',
    orientation: 'either',
    capabilities: ['calibration', 'assessment-observation'],
    scenarios: [CAMERA_SCENARIO, CALIBRATION_SCENARIO, { id: 'low-confidence', label: 'Low confidence', assertionType: 'assessment-evidence' }],
    title: 'Standing Roll Down',
    view: 'Side view',
    instruction: 'Stay side-on with feet grounded and arms relaxed.',
    cue: 'Roll down slowly, pause at your comfortable range, then return to standing twice.',
  },
  {
    id: 'assessment:seated_trunk_rotation',
    kind: 'assessment',
    assessmentMovementKey: 'seated_trunk_rotation',
    displayName: 'Spine Twist',
    exerciseName: 'Spine Twist',
    postureFamily: 'seated',
    trackingMode: 'manual',
    orientation: 'either',
    capabilities: ['calibration', 'assessment-observation'],
    scenarios: [CAMERA_SCENARIO, CALIBRATION_SCENARIO, { id: 'low-confidence', label: 'Low confidence', assertionType: 'assessment-evidence' }],
    title: 'Seated trunk rotation',
    view: 'Front view',
    instruction: 'Sit tall facing the camera with shoulders and hips clearly visible.',
    cue: 'Rotate gently left and right, returning to center each time.',
  },
])

const POSTURE_NAMES: Readonly<Record<PostureFamily, readonly string[]>> = {
  standing: ['Standing Roll Down'],
  seated: ['Spine Stretch Forward', 'Mermaid Stretch', 'Spine Twist', 'Saw'],
  supine: ['Plank Hold', 'Glute Bridge', 'Pelvic Tilts', 'Hundred', 'Single Leg Stretch', 'Diaphragmatic Breathing', 'Pelvic Floor Activation', 'Chest Lift', 'Dead Bug', 'Femur Arcs', 'Bent Knee Opening', 'Supine Knee Sways', 'Arm Arcs', 'Assisted Roll Up', 'Roll Up', 'Hundred Prep', 'Criss Cross', 'Single Leg Circle', 'Double Leg Stretch'],
  'side-lying': ['Clamshell', 'Side Kick', 'Book Opening'],
  prone: ['Swan Prep', 'Prone Press Up', 'Swan', 'Single Leg Kick', 'Double Leg Kick'],
  quadruped: ['Cat-Cow Stretch', "Child's Pose Hold", 'Quadruped Rock Back'],
  'full-body': ['Leg Pull Front Prep', 'Leg Pull Back', 'Side Lift', 'Pilates Push Up'],
}

function postureFamilyFor(name: string): PostureFamily {
  for (const [family, names] of Object.entries(POSTURE_NAMES) as [PostureFamily, readonly string[]][]) {
    if (names.includes(name)) return family
  }
  return 'standing'
}

function stableExerciseId(name: string) {
  return `exercise:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

const exerciseNames = Array.from(new Set([
  ...getFloorExerciseNames(),
  ...getExerciseTrackingOverrideNames(),
])).sort((left, right) => left.localeCompare(right))

export const EXERCISE_TEST_MOVEMENTS: readonly ExerciseTestableMovement[] = Object.freeze(
  exerciseNames.map(exerciseName => {
    const floor = getFloorExerciseNames().includes(exerciseName)
    const profile = getExerciseTrackingProfile(exerciseName, floor)
    const automatic = profile.mode === 'auto'
    return {
      id: stableExerciseId(exerciseName),
      kind: 'exercise' as const,
      displayName: exerciseName,
      exerciseName,
      postureFamily: postureFamilyFor(exerciseName),
      trackingMode: automatic ? 'automatic' as const : 'manual' as const,
      orientation: profile.cameraOrientation,
      capabilities: automatic
        ? ['calibration', 'repetition-counting', 'form-feedback'] as const
        : ['calibration', 'form-feedback'] as const,
      scenarios: automatic
        ? [CAMERA_SCENARIO, CALIBRATION_SCENARIO, { id: 'automatic-count', label: 'Automatic count', assertionType: 'automatic-count' as const }]
        : [CAMERA_SCENARIO, CALIBRATION_SCENARIO, { id: 'manual-count', label: 'Manual count', assertionType: 'manual-count' as const }],
    }
  }),
)

export const TESTABLE_MOVEMENTS: readonly TestableMovement[] = Object.freeze([
  ...ASSESSMENT_TEST_MOVEMENTS,
  ...EXERCISE_TEST_MOVEMENTS,
])

const MOVEMENT_BY_ID = new Map(TESTABLE_MOVEMENTS.map(entry => [entry.id, entry]))

export function getTestableMovement(id: string): TestableMovement | undefined {
  return MOVEMENT_BY_ID.get(id)
}
