export interface DetectionGeometry {
  sourceWidth: number
  sourceHeight: number
  detectionWidth: number
  detectionHeight: number
  scaleX: number
  scaleY: number
  paddingX: number
  paddingY: number
  orientation: 'portrait' | 'landscape'
}

export interface NormalizedLandmark {
  x: number
  y: number
  z?: number
  visibility?: number
  [key: string]: unknown
}

const MAX_DETECTION_EDGE = 640

export function createDetectionGeometry(
  sourceWidth: number,
  sourceHeight: number,
): DetectionGeometry {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Pose detection geometry requires positive source dimensions.')
  }

  const scale = Math.min(1, MAX_DETECTION_EDGE / Math.max(sourceWidth, sourceHeight))
  const detectionWidth = Math.max(1, Math.round(sourceWidth * scale))
  const detectionHeight = Math.max(1, Math.round(sourceHeight * scale))

  return {
    sourceWidth,
    sourceHeight,
    detectionWidth,
    detectionHeight,
    scaleX: detectionWidth / sourceWidth,
    scaleY: detectionHeight / sourceHeight,
    paddingX: 0,
    paddingY: 0,
    orientation: sourceHeight > sourceWidth ? 'portrait' : 'landscape',
  }
}

export function sourceLandmarkToDetection<T extends NormalizedLandmark>(
  landmark: T,
  geometry: DetectionGeometry,
): T {
  return {
    ...landmark,
    x: (landmark.x * geometry.sourceWidth * geometry.scaleX + geometry.paddingX)
      / geometry.detectionWidth,
    y: (landmark.y * geometry.sourceHeight * geometry.scaleY + geometry.paddingY)
      / geometry.detectionHeight,
  }
}

export function detectionLandmarkToSource<T extends NormalizedLandmark>(
  landmark: T,
  geometry: DetectionGeometry,
): T {
  return {
    ...landmark,
    x: ((landmark.x * geometry.detectionWidth) - geometry.paddingX)
      / (geometry.sourceWidth * geometry.scaleX),
    y: ((landmark.y * geometry.detectionHeight) - geometry.paddingY)
      / (geometry.sourceHeight * geometry.scaleY),
  }
}
