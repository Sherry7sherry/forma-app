import type { BodyMirrorResult } from './types'

export type SessionBodyPolicy = 'allow' | 'prompt_assessment' | 'block_safety'

export function deriveSessionBodyPolicy(result: BodyMirrorResult): SessionBodyPolicy {
  if (result.safety.shouldPause) return 'block_safety'
  if (result.dimensions.mobility.state === 'no_data' || result.dimensions.control.state === 'no_data') {
    return 'prompt_assessment'
  }
  return 'allow'
}
