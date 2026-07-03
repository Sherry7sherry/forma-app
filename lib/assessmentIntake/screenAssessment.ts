import type {
  AssessmentIntake,
  AssessmentRoute,
  MovementConstraint,
  PolicyReason,
} from './types'

export function screenAssessment(input: AssessmentIntake): AssessmentRoute {
  if (input.safetySignals.length > 0 || input.sensation === 'numb_or_radiating') {
    return {
      mode: 'stop',
      constraints: [],
      reasons: [{
        ruleId: 'SAFETY_CURRENT_STOP_SIGNAL',
        evidencePaths: ['intake.safetySignals', 'intake.sensation'],
        userMessage: 'Your current answers include a signal that should pause movement assessment.',
      }],
    }
  }

  const constraints: MovementConstraint[] = []
  const reasons: PolicyReason[] = []
  const shoulderHistory = input.injuryRegions.some(region => region.includes('shoulder'))
  const backHistory = input.injuryRegions.some(region => region.includes('back'))

  if (shoulderHistory && input.injuryStatus !== 'none') {
    constraints.push({ kind: 'reduce_range', movement: 'side_arm_raise' })
    constraints.push({ kind: 'optional_single_arm_compare', movement: 'side_arm_raise' })
    reasons.push({
      ruleId: 'INJURY_SHOULDER_MODIFY',
      evidencePaths: ['intake.injuryStatus', 'intake.injuryRegions'],
      userMessage: 'The arm raise will start in a smaller comfortable range.',
    })
  }

  if (backHistory && input.injuryStatus === 'recovering') {
    constraints.push({ kind: 'reduce_range', movement: 'standing_roll_down' })
    reasons.push({
      ruleId: 'INJURY_BACK_REDUCE_RANGE',
      evidencePaths: ['intake.injuryStatus', 'intake.injuryRegions'],
      userMessage: 'The roll down will use a smaller comfortable range.',
    })
  }

  return constraints.length > 0
    ? { mode: 'modified', constraints, reasons }
    : { mode: 'standard', constraints: [], reasons }
}
