interface LandmarkVisibility {
  visibility?: number
}

interface MissingRequiredBodyPartsInput {
  landmarks: readonly LandmarkVisibility[] | null | undefined
  requiredLandmarks: readonly number[]
  minVisibility: number
}

interface PairedBodyRegion {
  left: number
  right: number
  singular: string
  plural: string
}

const HEAD_LANDMARK = 0
const PAIRED_BODY_REGIONS: readonly PairedBodyRegion[] = [
  { left: 11, right: 12, singular: 'shoulder', plural: 'shoulders' },
  { left: 23, right: 24, singular: 'hip', plural: 'hips' },
  { left: 25, right: 26, singular: 'knee', plural: 'knees' },
  { left: 27, right: 28, singular: 'ankle', plural: 'ankles' },
  { left: 13, right: 14, singular: 'elbow', plural: 'elbows' },
  { left: 15, right: 16, singular: 'wrist', plural: 'wrists' },
]
const KNOWN_LANDMARKS = new Set([
  HEAD_LANDMARK,
  ...PAIRED_BODY_REGIONS.flatMap(region => [region.left, region.right]),
])

export function missingRequiredBodyParts({
  landmarks,
  requiredLandmarks,
  minVisibility,
}: MissingRequiredBodyPartsInput): string[] {
  const required = new Set(requiredLandmarks)
  const missing = new Set(requiredLandmarks.filter(
    index => (landmarks?.[index]?.visibility ?? 0) < minVisibility,
  ))
  const labels: string[] = []

  if (required.has(HEAD_LANDMARK) && missing.has(HEAD_LANDMARK)) labels.push('head')

  for (const region of PAIRED_BODY_REGIONS) {
    const leftRequired = required.has(region.left)
    const rightRequired = required.has(region.right)
    const leftMissing = leftRequired && missing.has(region.left)
    const rightMissing = rightRequired && missing.has(region.right)

    if (leftMissing && rightMissing) labels.push(`both ${region.plural}`)
    else if (leftMissing) labels.push(`left ${region.singular}`)
    else if (rightMissing) labels.push(`right ${region.singular}`)
  }

  if (requiredLandmarks.some(index => missing.has(index) && !KNOWN_LANDMARKS.has(index))) {
    labels.push('required keypoint')
  }

  return labels
}
