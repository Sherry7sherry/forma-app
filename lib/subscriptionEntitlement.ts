import type { SessionBodyPolicy } from './bodyMirror/sessionPolicy'

export type TrainingEntitlement =
  | 'block_safety'
  | 'allow_free_personalized'
  | 'allow_subscriber'
  | 'require_trial'

export interface TrainingEntitlementInput {
  bodyPolicy: SessionBodyPolicy
  subscriptionStatus: string | null
  completedPersonalizedIntroSessions: number
  hasPartialPersonalizedIntro: boolean
}

export function deriveTrainingEntitlement(input: TrainingEntitlementInput): TrainingEntitlement {
  if (input.bodyPolicy === 'block_safety') return 'block_safety'
  if (input.subscriptionStatus === 'pro' || input.subscriptionStatus === 'founding') {
    return 'allow_subscriber'
  }
  if (input.hasPartialPersonalizedIntro || input.completedPersonalizedIntroSessions === 0) {
    return 'allow_free_personalized'
  }
  return 'require_trial'
}
