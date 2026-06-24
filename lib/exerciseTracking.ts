export type TrackingMode = 'auto' | 'manual'
export type CameraOrientation = 'portrait' | 'landscape' | 'either'

export interface ExerciseTrackingProfile {
  mode: TrackingMode
  landmarks: number[]
  minVisibility: number
  minVisibleRatio: number
  minVisibleLandmarks: number
  confidenceThreshold: number
  engageThreshold: number
  returnThreshold: number
  trackingGraceMs: number
  cameraOrientation: CameraOrientation
}

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

const FLOOR_PROFILE: ExerciseTrackingProfile = {
  ...SUPINE_PROFILE,
}

const UPRIGHT_PROFILE: ExerciseTrackingProfile = {
  ...STANDING_PROFILE,
}

const PROFILE_OVERRIDES: Record<string, Partial<ExerciseTrackingProfile>> = {
  'Cat-Cow Stretch': {
    ...QUADRUPED_PROFILE,
    landmarks: [0, 11, 12, 23, 24, 25, 26],
    engageThreshold: 0.12,
    returnThreshold: 0.05,
  },
  'Pelvic Tilts': {
    ...SUPINE_PROFILE,
    engageThreshold: 0.1,
    returnThreshold: 0.045,
  },
  'Swan Prep': { ...PRONE_PROFILE, engageThreshold: 0.12, returnThreshold: 0.05 },
  'Glute Bridge': { ...SUPINE_PROFILE, engageThreshold: 0.16, returnThreshold: 0.065 },
  "Child's Pose Hold": { ...QUADRUPED_PROFILE, engageThreshold: 0.1, returnThreshold: 0.045 },
  'Clamshell': {
    ...SIDE_LYING_PROFILE,
    landmarks: [23, 24, 25, 26, 27, 28],
    minVisibleLandmarks: 4,
    engageThreshold: 0.12,
    returnThreshold: 0.05,
  },
  'Pelvic Floor Activation': { ...SUPINE_PROFILE, mode: 'manual' },
  'Diaphragmatic Breathing': { ...SUPINE_PROFILE, mode: 'manual' },
  'Chest Lift': { ...SUPINE_PROFILE, engageThreshold: 0.12, returnThreshold: 0.05 },
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
  'Spine Twist': { ...SEATED_PROFILE, cameraOrientation: 'either', engageThreshold: 0.12, returnThreshold: 0.05 },
  'Single Leg Kick': { ...PRONE_PROFILE, engageThreshold: 0.13, returnThreshold: 0.055 },
  'Saw': { ...SEATED_PROFILE, cameraOrientation: 'either', minVisibleRatio: 0.62, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Leg Pull Back': { ...FULL_BODY_PROFILE, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Side Lift': { ...FULL_BODY_PROFILE, landmarks: SIDE_LYING_LANDMARKS, minVisibleRatio: 0.7, minVisibleLandmarks: 6, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Single Leg Stretch': { ...SUPINE_PROFILE, engageThreshold: 0.15, returnThreshold: 0.06 },
  'Criss Cross': { ...SUPINE_PROFILE, landmarks: [11, 12, 13, 14, 23, 24, 25, 26, 27, 28], minVisibleRatio: 0.6, engageThreshold: 0.14, returnThreshold: 0.055 },
  'Single Leg Circle': { ...SUPINE_PROFILE, landmarks: [23, 24, 25, 26, 27, 28], minVisibleLandmarks: 4, engageThreshold: 0.13, returnThreshold: 0.05 },
  'Double Leg Kick': { ...PRONE_PROFILE, minVisibleRatio: 0.65, minVisibleLandmarks: 7, engageThreshold: 0.16, returnThreshold: 0.065 },
  'Double Leg Stretch': { ...SUPINE_PROFILE, landmarks: STANDING_LANDMARKS, minVisibleRatio: 0.65, minVisibleLandmarks: 7, engageThreshold: 0.17, returnThreshold: 0.07 },
  'Pilates Push Up': { ...FULL_BODY_PROFILE, engageThreshold: 0.2, returnThreshold: 0.08 },
}

export const FLOOR_EXERCISE_NAMES = new Set([
  'Cat-Cow Stretch',
  'Plank Hold',
  "Child's Pose Hold",
  'Glute Bridge',
  'Pelvic Tilts',
  'Swan Prep',
  'Hundred',
  'Single Leg Stretch',
  'Clamshell',
  'Diaphragmatic Breathing',
  'Pelvic Floor Activation',
  'Chest Lift',
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
  'Swan',
  'Spine Twist',
  'Single Leg Kick',
  'Saw',
  'Leg Pull Back',
  'Side Lift',
  'Criss Cross',
  'Single Leg Circle',
  'Double Leg Kick',
  'Double Leg Stretch',
  'Pilates Push Up',
])

export function getExerciseTrackingProfile(
  exerciseName: string | undefined,
  isFloorExercise: boolean,
  _durationType?: string,
): ExerciseTrackingProfile {
  const base = isFloorExercise ? FLOOR_PROFILE : UPRIGHT_PROFILE
  const override = exerciseName ? PROFILE_OVERRIDES[exerciseName] : undefined
  return {
    ...base,
    ...override,
    landmarks: override?.landmarks ?? base.landmarks,
  }
}
