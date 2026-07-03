import type {
  AssessmentReport,
  AssessmentReportClaimKey,
  AssessmentReportSection,
  ComposeAssessmentReportInput,
} from './types'

const RELIABLE_CONFIDENCE = 0.70

const FOCUS_LABELS: Record<string, string> = {
  neck_shoulders: 'neck and shoulders',
  lower_back: 'lower back',
  shoulder_mobility: 'shoulder mobility',
  spine_mobility: 'spinal mobility',
  trunk_control: 'trunk control',
  reduce_sitting_stiffness: 'less stiffness after sitting',
}

const SENSATION_LABELS: Record<string, string> = {
  none: 'generally comfortable',
  tight: 'tight',
  achy: 'achy',
  painful: 'painful',
  numb_or_radiating: 'numb or radiating',
}

const CLAIM_TEMPLATES: Record<AssessmentReportClaimKey, { title: string; body: string }> = {
  arm_raise_torso_drift: {
    title: 'Your trunk joined the arm raise',
    body: 'More torso lean was observed during arm raising. Building trunk control may help the shoulders move with less compensation.',
  },
  controlled_forward_bend: {
    title: 'Your forward bend stayed controlled',
    body: 'Your roll down showed controlled movement through the forward bend.',
  },
  rotation_difference: {
    title: 'Your rotation was different side to side',
    body: 'A side-to-side difference was observed during seated rotation. The plan can give the more limited direction extra attention.',
  },
}

function readableList(values: string[]): string {
  const labels = values.map(value => FOCUS_LABELS[value] ?? value.replaceAll('_', ' '))
  if (labels.length === 0) return 'how your body feels after sitting'
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

function bodyStory(input: ComposeAssessmentReportInput): AssessmentReportSection {
  const focus = readableList(input.intake.focusRegions)
  const sensation = SENSATION_LABELS[input.intake.sensation] ?? input.intake.sensation
  return {
    id: 'body-story',
    kind: 'body_story',
    visibility: 'free',
    title: 'What you told Forma today',
    body: `You described ${focus} as ${sensation}. This context shapes the assessment, but it is not a diagnosis.`,
    evidenceIds: [],
    confidence: null,
  }
}

function safetyDisclosure(): AssessmentReportSection {
  return {
    id: 'safety-disclosure',
    kind: 'safety',
    visibility: 'free',
    title: 'What this report can tell you',
    body: 'Forma reports movement observations and changes against your own baseline. It does not diagnose medical conditions.',
    evidenceIds: [],
    confidence: null,
  }
}

function safetyHold(input: ComposeAssessmentReportInput): AssessmentReport {
  const reason = input.route.reasons[0]?.userMessage
    ?? 'Pause movement for now and seek appropriate professional support before continuing.'
  return {
    schemaVersion: 1,
    engineVersion: input.coaching.engineVersion,
    status: 'safety_hold',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    assessmentAsOf: input.assessment.completedAt,
    sections: [{
      id: 'safety-hold',
      kind: 'safety',
      visibility: 'free',
      title: 'Pause movement for now',
      body: reason,
      evidenceIds: [],
      confidence: null,
    }],
    triggeredRuleIds: [...new Set([
      ...input.route.reasons.map(item => item.ruleId),
      ...input.coaching.trace.map(item => item.ruleId),
    ])],
  }
}

export function composeAssessmentReport(input: ComposeAssessmentReportInput): AssessmentReport {
  if (input.route.mode === 'stop' || input.coaching.safety === 'stop') {
    return safetyHold(input)
  }

  const reliableCapture = input.assessment.captureMode === 'camera'
    && input.assessment.status === 'completed'
    && (input.assessment.overallConfidence ?? 0) >= RELIABLE_CONFIDENCE
    && input.freshness !== 'stale'
  const insight = reliableCapture
    ? [...input.coaching.insights]
      .filter(item => item.confidence >= RELIABLE_CONFIDENCE && item.evidenceIds.length > 0)
      .sort((a, b) => b.confidence - a.confidence)[0]
    : undefined

  const common = [bodyStory(input), safetyDisclosure()]
  const triggeredRuleIds = [...new Set(input.coaching.trace.map(item => item.ruleId))]

  if (!insight) {
    return {
      schemaVersion: 1,
      engineVersion: input.coaching.engineVersion,
      status: 'insufficient_evidence',
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      assessmentAsOf: input.assessment.completedAt,
      sections: [...common, {
        id: 'reassessment-needed',
        kind: 'reassessment',
        visibility: 'free',
        title: 'Let’s get a clearer movement read',
        body: 'There is not enough reliable camera evidence for a movement insight yet. You can retry when you are ready.',
        evidenceIds: [],
        confidence: null,
      }],
      triggeredRuleIds,
    }
  }

  const template = CLAIM_TEMPLATES[insight.claimKey]
  const focus = readableList(input.coaching.plan.focusAreas)
  return {
    schemaVersion: 1,
    engineVersion: input.coaching.engineVersion,
    status: 'ready',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    assessmentAsOf: input.assessment.completedAt,
    sections: [...common, {
      id: insight.id,
      kind: 'insight',
      visibility: 'free',
      title: template.title,
      body: template.body,
      claimKey: insight.claimKey,
      evidenceIds: insight.evidenceIds,
      confidence: insight.confidence,
    }, {
      id: 'training-direction',
      kind: 'training_direction',
      visibility: 'free',
      title: 'A useful direction from here',
      body: `Your next movement work can prioritize ${focus}.`,
      evidenceIds: insight.evidenceIds,
      confidence: insight.confidence,
    }, {
      id: 'training-path',
      kind: 'training_path',
      visibility: 'paid',
      title: `Your ${input.coaching.plan.durationMinutes}-minute ${focus} path`,
      body: 'Unlock the full exercise sequence, movement alternatives, and reassessment updates.',
      evidenceIds: insight.evidenceIds,
      confidence: insight.confidence,
    }],
    triggeredRuleIds,
  }
}
