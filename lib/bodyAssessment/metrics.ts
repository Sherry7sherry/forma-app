import { BODY_MIRROR_CONFIDENCE_THRESHOLD, type BodyMirrorMovement } from '../bodyMirror/types'
import type {
  AssessmentFailureReason,
  AssessmentPoseSample,
  DerivedObservation,
  MovementDerivation,
  PoseLandmark,
} from './types'

const REQUIRED_LANDMARKS: Record<BodyMirrorMovement, number[]> = {
  side_arm_raise: [11, 12, 13, 14, 15, 16, 23, 24],
  standing_roll_down: [11, 12, 15, 16, 23, 24, 27, 28],
  seated_trunk_rotation: [11, 12, 23, 24],
}

const MIN_LANDMARK_VISIBILITY = 0.7
const MIN_VALID_SAMPLES = 8
const MIN_VALID_SAMPLE_RATIO = 0.6

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
}

function midpoint(left: PoseLandmark, right: PoseLandmark): PoseLandmark {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: ((left.z ?? 0) + (right.z ?? 0)) / 2,
    visibility: Math.min(left.visibility ?? 0, right.visibility ?? 0),
  }
}

function distance(left: PoseLandmark, right: PoseLandmark): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function torsoScale(landmarks: PoseLandmark[]): number {
  return Math.max(0.05, distance(midpoint(landmarks[11], landmarks[12]), midpoint(landmarks[23], landmarks[24])))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function armElevation(shoulder: PoseLandmark, wrist: PoseLandmark): number {
  const dx = wrist.x - shoulder.x
  const dy = wrist.y - shoulder.y
  const length = Math.hypot(dx, dy)
  if (length < 0.01) return 0
  return Math.acos(Math.max(-1, Math.min(1, dy / length))) * 180 / Math.PI
}

function sampleConfidence(sample: AssessmentPoseSample, required: number[]): number {
  return Math.min(sample.bodyConfidence, average(required.map(index => sample.landmarks[index]?.visibility ?? 0)))
}

function armRaiseSampleConfidence(sample: AssessmentPoseSample): number {
  const torso = average([11, 12, 23, 24].map(index => sample.landmarks[index]?.visibility ?? 0))
  const leftArm = average([11, 13, 15].map(index => sample.landmarks[index]?.visibility ?? 0))
  const rightArm = average([12, 14, 16].map(index => sample.landmarks[index]?.visibility ?? 0))
  return Math.min(sample.bodyConfidence, average([torso, Math.max(leftArm, rightArm)]))
}

function lowConfidence(
  samples: AssessmentPoseSample[],
  required: number[],
  reason: AssessmentFailureReason,
): MovementDerivation {
  return {
    status: 'low_confidence',
    overallConfidence: round(average(samples.map(sample => sampleConfidence(sample, required)))),
    reason,
  }
}

function hasCoverage(sample: AssessmentPoseSample, required: number[]): boolean {
  return sample.bodyConfidence >= BODY_MIRROR_CONFIDENCE_THRESHOLD
    && required.every(index => Boolean(sample.landmarks[index])
      && (sample.landmarks[index].visibility ?? 0) >= MIN_LANDMARK_VISIBILITY)
}

function hasMovementCoverage(movement: BodyMirrorMovement, sample: AssessmentPoseSample): boolean {
  if (sample.bodyConfidence < 0.65) return false
  if (movement !== 'side_arm_raise') return hasCoverage(sample, REQUIRED_LANDMARKS[movement])

  const visible = (indices: number[]) => indices.every(index => Boolean(sample.landmarks[index])
    && (sample.landmarks[index].visibility ?? 0) >= MIN_LANDMARK_VISIBILITY)
  return visible([11, 12, 23, 24]) && (visible([11, 13, 15]) || visible([12, 14, 16]))
}

function movementConfidence(movement: BodyMirrorMovement, sample: AssessmentPoseSample): number {
  return movement === 'side_arm_raise'
    ? armRaiseSampleConfidence(sample)
    : sampleConfidence(sample, REQUIRED_LANDMARKS[movement])
}

function observation(
  movementKey: BodyMirrorMovement,
  input: Omit<DerivedObservation, 'movementKey' | 'confidence'>,
  confidence: number,
): DerivedObservation {
  return { movementKey, ...input, confidence: round(confidence) }
}

function deriveArmRaise(samples: AssessmentPoseSample[], confidence: number): MovementDerivation {
  const first = samples[0].landmarks
  const scale = torsoScale(first)
  const baselineOffset = midpoint(first[11], first[12]).x - midpoint(first[23], first[24]).x
  const elevation = Math.max(...samples.flatMap(sample => [
    armElevation(sample.landmarks[11], sample.landmarks[15]),
    armElevation(sample.landmarks[12], sample.landmarks[16]),
  ]))
  const torsoDrift = Math.max(...samples.map(sample => {
    const landmarks = sample.landmarks
    const offset = midpoint(landmarks[11], landmarks[12]).x - midpoint(landmarks[23], landmarks[24]).x
    return Math.abs(offset - baselineOffset) / scale
  }))
  if (elevation < 30) return lowConfidence(samples, REQUIRED_LANDMARKS.side_arm_raise, 'range')
  return {
    status: 'reliable',
    overallConfidence: round(confidence),
    observations: [
      observation('side_arm_raise', {
        dimension: 'mobility', side: 'bilateral', metricKey: 'max_arm_elevation_deg',
        value: round(elevation), unit: 'deg', betterDirection: 'higher', changeThreshold: 5,
      }, confidence),
      observation('side_arm_raise', {
        dimension: 'control', side: 'center', metricKey: 'torso_drift_ratio',
        value: round(torsoDrift), unit: 'ratio', betterDirection: 'lower', changeThreshold: 0.05,
      }, confidence),
    ],
  }
}

function deriveRollDown(samples: AssessmentPoseSample[], confidence: number): MovementDerivation {
  const first = samples[0].landmarks
  const scale = torsoScale(first)
  const baselineWristToHip = midpoint(first[15], first[16]).y - midpoint(first[23], first[24]).y
  const baselineTorsoOffset = midpoint(first[11], first[12]).x - midpoint(first[23], first[24]).x
  const descent = Math.max(...samples.map(sample => {
    const landmarks = sample.landmarks
    const wristToHip = midpoint(landmarks[15], landmarks[16]).y - midpoint(landmarks[23], landmarks[24]).y
    return (wristToHip - baselineWristToHip) / scale
  }))
  const lateralDrift = Math.max(...samples.map(sample => {
    const landmarks = sample.landmarks
    const torsoOffset = midpoint(landmarks[11], landmarks[12]).x - midpoint(landmarks[23], landmarks[24]).x
    return Math.abs(torsoOffset - baselineTorsoOffset) / scale
  }))
  if (descent < 0.15) return lowConfidence(samples, REQUIRED_LANDMARKS.standing_roll_down, 'range')
  return {
    status: 'reliable',
    overallConfidence: round(confidence),
    observations: [
      observation('standing_roll_down', {
        dimension: 'mobility', side: 'center', metricKey: 'normalized_wrist_descent',
        value: round(descent), unit: 'ratio', betterDirection: 'higher', changeThreshold: 0.08,
      }, confidence),
      observation('standing_roll_down', {
        dimension: 'control', side: 'center', metricKey: 'lateral_torso_drift_ratio',
        value: round(lateralDrift), unit: 'ratio', betterDirection: 'lower', changeThreshold: 0.04,
      }, confidence),
    ],
  }
}

function deriveRotation(samples: AssessmentPoseSample[], confidence: number): MovementDerivation {
  const first = samples[0].landmarks
  const scale = torsoScale(first)
  const baselineRelativePelvis = midpoint(first[23], first[24]).x - midpoint(first[11], first[12]).x
  const shoulderDepth = samples.map(sample => (sample.landmarks[12].z ?? 0) - (sample.landmarks[11].z ?? 0))
  const rotationRange = (Math.max(...shoulderDepth) - Math.min(...shoulderDepth)) / scale
  const pelvisDrift = Math.max(...samples.map(sample => {
    const landmarks = sample.landmarks
    const relativePelvis = midpoint(landmarks[23], landmarks[24]).x - midpoint(landmarks[11], landmarks[12]).x
    return Math.abs(relativePelvis - baselineRelativePelvis) / scale
  }))
  if (rotationRange < 0.15) return lowConfidence(samples, REQUIRED_LANDMARKS.seated_trunk_rotation, 'range')
  return {
    status: 'reliable',
    overallConfidence: round(confidence),
    observations: [
      observation('seated_trunk_rotation', {
        dimension: 'mobility', side: 'bilateral', metricKey: 'shoulder_rotation_range_ratio',
        value: round(rotationRange), unit: 'ratio', betterDirection: 'higher', changeThreshold: 0.08,
      }, confidence),
      observation('seated_trunk_rotation', {
        dimension: 'control', side: 'center', metricKey: 'pelvis_drift_ratio',
        value: round(pelvisDrift), unit: 'ratio', betterDirection: 'lower', changeThreshold: 0.04,
      }, confidence),
    ],
  }
}

export interface MovementEvidence {
  ready: boolean
  validSampleCount: number
  totalSampleCount: number
  validSampleRatio: number
  reason: AssessmentFailureReason | null
}

function deriveFromValidSamples(
  movement: BodyMirrorMovement,
  samples: AssessmentPoseSample[],
): MovementDerivation {
  const required = REQUIRED_LANDMARKS[movement]
  const confidence = average(samples.map(sample => movementConfidence(movement, sample)))
  if (confidence < BODY_MIRROR_CONFIDENCE_THRESHOLD) return lowConfidence(samples, required, 'landmarks')
  if (movement === 'side_arm_raise') return deriveArmRaise(samples, confidence)
  if (movement === 'standing_roll_down') return deriveRollDown(samples, confidence)
  return deriveRotation(samples, confidence)
}

export function evaluateMovementEvidence(
  movement: BodyMirrorMovement,
  samples: AssessmentPoseSample[],
): MovementEvidence {
  const validSamples = samples.filter(sample => hasMovementCoverage(movement, sample))
  const validSampleRatio = samples.length ? validSamples.length / samples.length : 0
  let reason: AssessmentFailureReason | null = null

  if (samples.length < MIN_VALID_SAMPLES) reason = 'insufficient_samples'
  else if (validSampleRatio < MIN_VALID_SAMPLE_RATIO) reason = 'landmarks'
  else if (validSamples.length < MIN_VALID_SAMPLES) reason = 'insufficient_samples'
  else {
    const derived = deriveFromValidSamples(movement, validSamples)
    if (derived.status === 'low_confidence') reason = derived.reason
  }

  return {
    ready: reason === null,
    validSampleCount: validSamples.length,
    totalSampleCount: samples.length,
    validSampleRatio: round(validSampleRatio),
    reason,
  }
}

export function deriveMovementObservations(
  movement: BodyMirrorMovement,
  samples: AssessmentPoseSample[],
): MovementDerivation {
  const required = REQUIRED_LANDMARKS[movement]
  const evidence = evaluateMovementEvidence(movement, samples)
  if (!evidence.ready) return lowConfidence(samples, required, evidence.reason ?? 'insufficient_samples')
  return deriveFromValidSamples(movement, samples.filter(sample => hasMovementCoverage(movement, sample)))
}
