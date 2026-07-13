export interface PoseLandmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface TrackingCoverageOptions {
  minVisibility: number
  minVisibleRatio: number
  minVisibleLandmarks: number
}

export function visibleLandmarkCount(
  landmarks: PoseLandmark[] | null | undefined,
  indices: number[],
  minVisibility: number,
): number {
  if (!landmarks) return 0
  return indices.filter(index => (landmarks[index]?.visibility ?? 0) >= minVisibility).length
}

export function hasTrackingCoverage(
  landmarks: PoseLandmark[] | null | undefined,
  indices: number[],
  options: TrackingCoverageOptions,
): boolean {
  const ratioTarget = Math.ceil(indices.length * options.minVisibleRatio)
  const required = Math.min(indices.length, Math.max(options.minVisibleLandmarks, ratioTarget))
  return visibleLandmarkCount(landmarks, indices, options.minVisibility) >= required
}

export function evaluateSeatedTorsoFraming(
  landmarks: PoseLandmark[] | null | undefined,
): { ready: boolean; confidence: number } {
  if (!landmarks || landmarks.length < 25) return { ready: false, confidence: 0 }
  const coreIndices = [11, 12, 23, 24]
  const coreVisibility = coreIndices.map(index => landmarks[index]?.visibility ?? 0)
  const coreConfidence = coreVisibility.reduce((sum, value) => sum + value, 0) / coreVisibility.length
  const headConfidence = landmarks[0]?.visibility ?? 0
  const shoulders = centroid([landmarks[11], landmarks[12]])
  const hips = centroid([landmarks[23], landmarks[24]])
  const torsoSpan = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y)
  const requiredPoints = [landmarks[0], ...coreIndices.map(index => landmarks[index])]
  const withinFrame = requiredPoints.every(point => point
    && point.x >= -0.05 && point.x <= 1.05
    && point.y >= -0.05 && point.y <= 1.05)
  const ready = headConfidence >= 0.55
    && coreVisibility.every(value => value >= 0.65)
    && torsoSpan >= 0.12
    && withinFrame
  return {
    ready,
    confidence: ready ? (coreConfidence * 0.8) + (headConfidence * 0.2) : 0,
  }
}

export function hasSeatedTorsoFraming(landmarks: PoseLandmark[] | null | undefined): boolean {
  return evaluateSeatedTorsoFraming(landmarks).ready
}

function centroid(points: PoseLandmark[]) {
  return points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  )
}

function poseScale(landmarks: PoseLandmark[], indices: number[]): number {
  const shoulderPoints = [landmarks[11], landmarks[12]].filter(Boolean)
  const hipPoints = [landmarks[23], landmarks[24]].filter(Boolean)
  if (shoulderPoints.length && hipPoints.length) {
    const shoulders = centroid(shoulderPoints)
    const hips = centroid(hipPoints)
    const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y)
    if (torso >= 0.05) return torso
  }

  const points = indices.map(index => landmarks[index]).filter(Boolean)
  if (points.length < 2) return 1
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  return Math.max(0.05, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))
}

/**
 * Measures articulated movement while ignoring whole-body translation and
 * normalizing for the user's distance from the camera.
 */
export function normalizedPoseDistance(
  current: PoseLandmark[] | null | undefined,
  baseline: PoseLandmark[] | null | undefined,
  indices: number[],
  minVisibility: number,
): number {
  if (!current || !baseline) return 0
  const common = indices.filter(index =>
    (current[index]?.visibility ?? 0) >= minVisibility
    && (baseline[index]?.visibility ?? 0) >= minVisibility,
  )
  if (common.length < 3) return 0

  const currentPoints = common.map(index => current[index])
  const baselinePoints = common.map(index => baseline[index])
  const currentCenter = centroid(currentPoints)
  const baselineCenter = centroid(baselinePoints)
  const scale = poseScale(baseline, common)

  const total = common.reduce((sum, index) => {
    const currentPoint = current[index]
    const baselinePoint = baseline[index]
    const dx = (currentPoint.x - currentCenter.x) - (baselinePoint.x - baselineCenter.x)
    const dy = (currentPoint.y - currentCenter.y) - (baselinePoint.y - baselineCenter.y)
    return sum + Math.hypot(dx, dy) / scale
  }, 0)

  return total / common.length
}

export function isWithinTrackingGrace(lastConfidentAt: number | null, now: number, graceMs: number): boolean {
  return lastConfidentAt !== null && now - lastConfidentAt <= graceMs
}
