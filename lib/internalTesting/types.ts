import type { AssessmentMovement } from '../assessmentIntake/types.js'
import type { CameraOrientation } from '../exerciseTracking.js'

export type TestMovementKind = 'assessment' | 'exercise'
export type PostureFamily =
  | 'standing'
  | 'seated'
  | 'supine'
  | 'side-lying'
  | 'prone'
  | 'quadruped'
  | 'full-body'
export type TestTrackingMode = 'automatic' | 'manual' | 'timed'
export type TestCapability =
  | 'calibration'
  | 'repetition-counting'
  | 'form-feedback'
  | 'assessment-observation'
export type TestAssertionType =
  | 'camera-lifecycle'
  | 'calibration'
  | 'automatic-count'
  | 'manual-count'
  | 'timed-completion'
  | 'form-feedback'
  | 'assessment-evidence'

export interface TestScenarioDefinition {
  id: string
  label: string
  assertionType: TestAssertionType
}

interface TestableMovementBase {
  id: string
  displayName: string
  kind: TestMovementKind
  exerciseName: string
  postureFamily: PostureFamily
  trackingMode: TestTrackingMode
  orientation: CameraOrientation
  capabilities: readonly TestCapability[]
  scenarios: readonly TestScenarioDefinition[]
}

export interface AssessmentTestableMovement extends TestableMovementBase {
  kind: 'assessment'
  assessmentMovementKey: AssessmentMovement
  title: string
  view: string
  instruction: string
  cue: string
}

export interface ExerciseTestableMovement extends TestableMovementBase {
  kind: 'exercise'
}

export type TestableMovement = AssessmentTestableMovement | ExerciseTestableMovement
