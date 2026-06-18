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

const UPRIGHT_LANDMARKS = [11, 12, 13, 14, 23, 24, 25, 26, 27, 28]
const FLOOR_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28]

const UPRIGHT_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: UPRIGHT_LANDMARKS,
  minVisibility: 0.5,
  minVisibleRatio: 0.7,
  minVisibleLandmarks: 6,
  confidenceThreshold: 0.5,
  engageThreshold: 0.2,
  returnThreshold: 0.08,
  trackingGraceMs: 1_500,
  cameraOrientation: 'either',
}

const FLOOR_PROFILE: ExerciseTrackingProfile = {
  mode: 'auto',
  landmarks: FLOOR_LANDMARKS,
  minVisibility: 0.32,
  minVisibleRatio: 0.55,
  minVisibleLandmarks: 5,
  confidenceThreshold: 0.3,
  engageThreshold: 0.16,
  returnThreshold: 0.065,
  trackingGraceMs: 2_000,
  cameraOrientation: 'landscape',
}

const PROFILE_OVERRIDES: Record<string, Partial<ExerciseTrackingProfile>> = {
  'Cat-Cow Stretch': {
    landmarks: [0, 11, 12, 23, 24, 25, 26],
    engageThreshold: 0.12,
    returnThreshold: 0.05,
  },
  'Pelvic Tilts': {
    landmarks: [0, 11, 12, 23, 24, 25, 26, 27, 28],
    engageThreshold: 0.1,
    returnThreshold: 0.045,
  },
  'Swan Prep': { landmarks: [0, 11, 12, 23, 24, 25, 26, 27, 28] },
  'Glute Bridge': { landmarks: [0, 11, 12, 23, 24, 25, 26, 27, 28] },
  "Child's Pose Hold": { landmarks: [0, 11, 12, 23, 24, 25, 26, 27, 28] },
  'Clamshell': {
    landmarks: [23, 24, 25, 26, 27, 28],
    minVisibleLandmarks: 4,
    engageThreshold: 0.12,
    returnThreshold: 0.05,
  },
  'Pelvic Floor Activation': { mode: 'manual' },
  'Diaphragmatic Breathing': { mode: 'manual' },
}

export const FLOOR_EXERCISE_NAMES = new Set([
  'Cat-Cow Stretch', 'Plank Hold', "Child's Pose Hold", 'Glute Bridge',
  'Pelvic Tilts', 'Swan Prep', 'Hundred', 'Single Leg Stretch', 'Clamshell',
  'Diaphragmatic Breathing', 'Pelvic Floor Activation',
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
