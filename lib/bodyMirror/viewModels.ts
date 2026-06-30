import type {
  BodyMirrorDimensionKey,
  BodyMirrorFreshness,
  BodyMirrorResult,
  BodyMirrorStatus,
  DimensionState,
} from './types'

export interface SharedBodyMirrorViewModel {
  resultId: string
  status: BodyMirrorStatus
  freshness: BodyMirrorFreshness
  dimensionStates: Record<BodyMirrorDimensionKey, DimensionState>
}

function sharedModel(result: BodyMirrorResult): SharedBodyMirrorViewModel {
  return {
    resultId: result.resultId,
    status: result.status,
    freshness: result.freshness,
    dimensionStates: {
      comfort: result.dimensions.comfort.state,
      mobility: result.dimensions.mobility.state,
      control: result.dimensions.control.state,
    },
  }
}

export function createHomeBodyMirrorModel(result: BodyMirrorResult): SharedBodyMirrorViewModel {
  return sharedModel(result)
}

export function createProgressBodyMirrorModel(result: BodyMirrorResult): SharedBodyMirrorViewModel {
  return sharedModel(result)
}
