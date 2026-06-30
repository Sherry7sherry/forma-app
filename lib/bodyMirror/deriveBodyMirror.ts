import {
  BODY_MIRROR_CONFIDENCE_THRESHOLD,
  BODY_MIRROR_MOVEMENTS,
  CHECK_IN_FRESH_HOURS,
  MOVEMENT_FRESH_DAYS,
  MOVEMENT_STALE_DAYS,
  type BodyCheckInEvidence,
  type BodyMirrorActivity,
  type BodyMirrorDimension,
  type BodyMirrorDimensionKey,
  type BodyMirrorEvidence,
  type BodyMirrorFreshness,
  type BodyMirrorRecommendation,
  type BodyMirrorResult,
  type DeriveBodyMirrorOptions,
  type DimensionState,
  type MovementAssessmentEvidence,
  type MovementDimension,
  type MovementObservationEvidence,
  type SessionBodyFeeling,
} from './types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function newest<T>(items: T[], dateOf: (item: T) => string | null): T | undefined {
  return [...items].sort((left, right) => timestamp(dateOf(right)) - timestamp(dateOf(left)))[0]
}

function assessmentIsReliable(assessment: MovementAssessmentEvidence): boolean {
  return assessment.status === 'completed'
    && assessment.completedAt !== null
    && (assessment.overallConfidence ?? 0) >= BODY_MIRROR_CONFIDENCE_THRESHOLD
}

function reliableObservationsFor(
  assessmentId: string,
  observations: MovementObservationEvidence[],
): MovementObservationEvidence[] {
  return observations.filter(observation =>
    observation.assessmentId === assessmentId
    && observation.confidence >= BODY_MIRROR_CONFIDENCE_THRESHOLD,
  )
}

function hasCompleteBaselineCoverage(observations: MovementObservationEvidence[]): boolean {
  const movements = new Set(observations.map(observation => observation.movementKey))
  const dimensions = new Set(observations.map(observation => observation.dimension))
  return BODY_MIRROR_MOVEMENTS.every(movement => movements.has(movement))
    && dimensions.has('mobility')
    && dimensions.has('control')
}

function findBaseline(
  assessments: MovementAssessmentEvidence[],
  observations: MovementObservationEvidence[],
): MovementAssessmentEvidence | undefined {
  return assessments
    .filter(assessment => assessment.kind === 'baseline' && assessmentIsReliable(assessment))
    .sort((left, right) => timestamp(left.completedAt) - timestamp(right.completedAt))
    .find(assessment => hasCompleteBaselineCoverage(reliableObservationsFor(assessment.id, observations)))
}

function movementFreshness(asOf: string | null, now: Date): BodyMirrorFreshness {
  if (!asOf) return { level: 'none', asOf: null, label: 'No reliable movement data yet' }
  const ageDays = Math.max(0, (now.getTime() - timestamp(asOf)) / DAY_MS)
  if (ageDays <= MOVEMENT_FRESH_DAYS) {
    return { level: 'fresh', asOf, label: 'Movement data is current' }
  }
  if (ageDays <= MOVEMENT_STALE_DAYS) {
    return { level: 'aging', asOf, label: 'Movement data is getting older' }
  }
  return { level: 'stale', asOf, label: 'Movement data needs a refresh' }
}

function emptyDimension(key: BodyMirrorDimensionKey): BodyMirrorDimension {
  const labels: Record<BodyMirrorDimensionKey, string> = {
    comfort: 'Comfort',
    mobility: 'Mobility',
    control: 'Movement control',
  }
  return {
    key,
    state: 'no_data',
    label: labels[key],
    summary: 'Not enough evidence yet',
    detail: key === 'comfort'
      ? 'Add a quick body check-in to start this view.'
      : 'Complete a reliable movement baseline to start this view.',
    evidenceCount: 0,
    asOf: null,
  }
}

function stateCopy(key: BodyMirrorDimensionKey, state: DimensionState): Pick<BodyMirrorDimension, 'summary' | 'detail'> {
  const label = key === 'comfort' ? 'comfort' : key === 'mobility' ? 'mobility' : 'movement control'
  switch (state) {
    case 'baseline':
      return { summary: 'Your baseline is set', detail: `Future ${label} evidence will be compared with this starting point.` }
    case 'improved':
      return { summary: 'Improving from your baseline', detail: `Your latest reliable ${label} evidence is moving in a positive direction.` }
    case 'declined':
      return { summary: 'Below your recent baseline', detail: `Your latest reliable ${label} evidence suggests a gentler next step.` }
    case 'steady':
      return { summary: 'Similar to your baseline', detail: `Your latest reliable ${label} evidence is within the expected range.` }
    case 'no_data':
      return emptyDimension(key)
  }
}

function compareComfort(checkIns: BodyCheckInEvidence[]): BodyMirrorDimension {
  if (checkIns.length === 0) return emptyDimension('comfort')
  const ordered = [...checkIns].sort((left, right) => timestamp(left.recordedAt) - timestamp(right.recordedAt))
  const baseline = ordered.find(checkIn => checkIn.context === 'baseline') ?? ordered[0]
  const current = ordered[ordered.length - 1]
  let state: DimensionState = 'baseline'
  if (current.id !== baseline.id) {
    const delta = current.comfort - baseline.comfort
    state = delta >= 1 ? 'improved' : delta <= -1 ? 'declined' : 'steady'
  }
  return {
    key: 'comfort',
    state,
    label: 'Comfort',
    ...stateCopy('comfort', state),
    evidenceCount: ordered.length,
    asOf: current.recordedAt,
  }
}

function observationKey(observation: MovementObservationEvidence): string {
  return [
    observation.movementKey,
    observation.dimension,
    observation.side,
    observation.metricKey,
    observation.unit,
  ].join(':')
}

function compareMovementDimension(
  dimension: MovementDimension,
  baselineAssessment: MovementAssessmentEvidence,
  currentAssessment: MovementAssessmentEvidence,
  observations: MovementObservationEvidence[],
): BodyMirrorDimension {
  const baseline = reliableObservationsFor(baselineAssessment.id, observations)
    .filter(observation => observation.dimension === dimension)
  const current = reliableObservationsFor(currentAssessment.id, observations)
    .filter(observation => observation.dimension === dimension)
  const asOf = currentAssessment.completedAt

  if (baseline.length === 0) return emptyDimension(dimension)
  if (baselineAssessment.id === currentAssessment.id || current.length === 0) {
    const state: DimensionState = 'baseline'
    return {
      key: dimension,
      state,
      label: dimension === 'mobility' ? 'Mobility' : 'Movement control',
      ...stateCopy(dimension, state),
      evidenceCount: baseline.length,
      asOf: baselineAssessment.completedAt,
    }
  }

  const baselineByMetric = new Map(baseline.map(observation => [observationKey(observation), observation]))
  let improved = 0
  let declined = 0
  let comparable = 0

  for (const currentObservation of current) {
    const baselineObservation = baselineByMetric.get(observationKey(currentObservation))
    if (!baselineObservation) continue
    comparable += 1
    const direction = currentObservation.betterDirection === 'higher' ? 1 : -1
    const delta = (currentObservation.value - baselineObservation.value) * direction
    const threshold = Math.max(currentObservation.changeThreshold, baselineObservation.changeThreshold)
    if (delta > threshold) improved += 1
    if (delta < -threshold) declined += 1
  }

  const state: DimensionState = comparable === 0
    ? 'baseline'
    : improved > declined
      ? 'improved'
      : declined > improved
        ? 'declined'
        : 'steady'

  return {
    key: dimension,
    state,
    label: dimension === 'mobility' ? 'Mobility' : 'Movement control',
    ...stateCopy(dimension, state),
    evidenceCount: comparable || baseline.length,
    asOf,
  }
}

function sessionFeelingValue(feeling: SessionBodyFeeling | null): number | null {
  if (!feeling) return null
  return { tight: 1, okay: 2, good: 3, great: 4 }[feeling]
}

function latestSessionWasWorse(evidence: BodyMirrorEvidence): boolean {
  const comparable = evidence.sessions.filter(session =>
    session.completedAt && session.bodyFeelBefore && session.bodyFeelAfter,
  )
  const latest = newest(comparable, session => session.completedAt)
  if (!latest) return false
  const before = sessionFeelingValue(latest.bodyFeelBefore)
  const after = sessionFeelingValue(latest.bodyFeelAfter)
  return before !== null && after !== null && after < before
}

function recommendationFor({
  hasBaseline,
  safetyHold,
  freshness,
  checkInDue,
  latestComfort,
  hasDecline,
  worsened,
}: {
  hasBaseline: boolean
  safetyHold: boolean
  freshness: BodyMirrorFreshness
  checkInDue: boolean
  latestComfort: number | null
  hasDecline: boolean
  worsened: boolean
}): BodyMirrorRecommendation {
  const base = { adjustedForWorseFeeling: false }
  if (safetyHold) {
    return {
      ...base,
      mode: 'pause',
      intensity: 'none',
      title: 'Pause movement for now',
      reason: 'Your latest check-in includes a stop signal. Stop and seek appropriate medical advice before continuing.',
      durationMinutes: null,
      durationSeconds: null,
    }
  }
  if (!hasBaseline) {
    return {
      ...base,
      mode: 'baseline',
      intensity: 'gentle',
      title: 'Build your first body baseline',
      reason: 'Three simple, no-mat movements give Forma a reliable starting point that belongs only to you.',
      durationMinutes: 2,
      durationSeconds: null,
    }
  }
  if (freshness.level === 'stale') {
    return {
      ...base,
      mode: 'reassess',
      intensity: 'gentle',
      title: 'Refresh your body baseline',
      reason: 'Your last reliable movement check is more than 30 days old, so a new recommendation needs fresher evidence.',
      durationMinutes: 2,
      durationSeconds: null,
    }
  }
  if (checkInDue) {
    return {
      ...base,
      mode: 'check_in',
      intensity: 'none',
      title: 'How does your body feel today?',
      reason: 'A 15-second check-in keeps today’s recommendation connected to how you feel now.',
      durationMinutes: null,
      durationSeconds: 15,
    }
  }
  if (worsened) {
    return {
      mode: 'quick',
      intensity: 'gentle',
      title: 'Take a gentler desk reset',
      reason: 'You felt worse after your last session, so today’s recommendation is shorter and gentler.',
      durationMinutes: 4,
      durationSeconds: null,
      adjustedForWorseFeeling: true,
    }
  }
  if ((latestComfort ?? 3) <= 2 || hasDecline) {
    return {
      ...base,
      mode: 'quick',
      intensity: 'gentle',
      title: 'Start with a short reset',
      reason: 'Your latest evidence favors a low-pressure movement break before a longer session.',
      durationMinutes: 4,
      durationSeconds: null,
    }
  }
  if ((latestComfort ?? 3) >= 4) {
    return {
      ...base,
      mode: 'full',
      intensity: 'standard',
      title: 'You are ready for a full session',
      reason: 'Your check-in feels comfortable and your movement evidence is current.',
      durationMinutes: 20,
      durationSeconds: null,
    }
  }
  return {
    ...base,
    mode: 'quick',
    intensity: 'standard',
    title: 'Reset after sitting',
    reason: 'Your current mirror supports a short mobility and control break right now.',
    durationMinutes: 4,
    durationSeconds: null,
  }
}

function calculateActivity(sessions: BodyMirrorEvidence['sessions'], now: Date): BodyMirrorActivity {
  const completed = sessions.filter(session => session.completedAt && !session.isPartial)
  const completedMinutes = Math.round(
    completed.reduce((total, session) => total + Math.max(0, session.durationSeconds), 0) / 60,
  )
  const days = new Set(completed.map(session => session.completedAt!.slice(0, 10)))
  let currentStreak = 0
  for (let offset = 0; offset < 366; offset += 1) {
    const day = new Date(now)
    day.setUTCDate(day.getUTCDate() - offset)
    if (days.has(day.toISOString().slice(0, 10))) currentStreak += 1
    else if (offset > 0) break
  }
  return {
    completedSessions: completed.length,
    completedMinutes,
    currentStreak,
    partialAttempts: sessions.filter(session => session.completedAt && session.isPartial).length,
  }
}

export function deriveBodyMirror(
  evidence: BodyMirrorEvidence,
  options: DeriveBodyMirrorOptions = {},
): BodyMirrorResult {
  const now = options.now ?? new Date()
  const baseline = findBaseline(evidence.assessments, evidence.observations)
  const reliableAssessments = evidence.assessments.filter(assessment =>
    assessmentIsReliable(assessment)
    && reliableObservationsFor(assessment.id, evidence.observations).length > 0,
  )
  const latestReliable = newest(reliableAssessments, assessment => assessment.completedAt)
  const latestAttempt = newest(evidence.assessments, assessment => assessment.completedAt)
  const latestCheckIn = newest(evidence.checkIns, checkIn => checkIn.recordedAt)
  const freshness = movementFreshness(latestReliable?.completedAt ?? null, now)
  const safetySignals = latestCheckIn?.safetySignals ?? []
  const safetyHold = safetySignals.length > 0
  const checkInAgeHours = latestCheckIn
    ? Math.max(0, (now.getTime() - timestamp(latestCheckIn.recordedAt)) / HOUR_MS)
    : Number.POSITIVE_INFINITY
  const checkInDue = checkInAgeHours > CHECK_IN_FRESH_HOURS
  const confidenceNotice = latestAttempt && latestReliable && latestAttempt.id !== latestReliable.id
    && (!assessmentIsReliable(latestAttempt)
      || reliableObservationsFor(latestAttempt.id, evidence.observations).length === 0)
    ? 'latest_attempt_not_applied' as const
    : 'none' as const

  const comfort = compareComfort(evidence.checkIns)
  const mobility = baseline && latestReliable
    ? compareMovementDimension('mobility', baseline, latestReliable, evidence.observations)
    : emptyDimension('mobility')
  const control = baseline && latestReliable
    ? compareMovementDimension('control', baseline, latestReliable, evidence.observations)
    : emptyDimension('control')

  let status: BodyMirrorResult['status']
  if (safetyHold) status = 'safety_hold'
  else if (!baseline) {
    const failedForConfidence = latestAttempt
      && (latestAttempt.status === 'low_confidence'
        || latestAttempt.status === 'camera_unavailable'
        || (latestAttempt.overallConfidence ?? 0) < BODY_MIRROR_CONFIDENCE_THRESHOLD)
    status = failedForConfidence ? 'low_confidence' : 'no_data'
  }
  else if (freshness.level === 'stale') status = 'stale'
  else if (checkInDue) status = 'check_in_due'
  else status = 'current'

  const worsened = latestSessionWasWorse(evidence)
  const recommendation = recommendationFor({
    hasBaseline: Boolean(baseline),
    safetyHold,
    freshness,
    checkInDue,
    latestComfort: latestCheckIn?.comfort ?? null,
    hasDecline: mobility.state === 'declined' || control.state === 'declined',
    worsened,
  })
  const dimensions = { comfort, mobility, control }
  const resultId = [status, freshness.asOf ?? 'none', latestCheckIn?.recordedAt ?? 'none'].join(':')

  return {
    resultId,
    status,
    confidenceNotice,
    freshness,
    checkInAsOf: latestCheckIn?.recordedAt ?? null,
    dimensions,
    recommendation,
    safety: { shouldPause: safetyHold, signals: safetySignals },
    activity: calculateActivity(evidence.sessions, now),
  }
}
