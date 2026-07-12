export type TrackingEventType =
  | 'camera_status' | 'calibration' | 'pose_sample' | 'phase_change' | 'count'
  | 'feedback' | 'blocker' | 'retry' | 'synthetic_transition'
  | 'persistence_error' | 'attempt_end'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type TrackingEventData = Record<string, JsonValue>

export interface TrackingEventContext {
  attemptId: string
  movementId: string
  movementName: string
  buildVersion: string
  profileVersion: string
  startedAtMs: number
}

export interface TrackingEvent {
  attemptId: string
  movementId: string
  movementName: string
  elapsedMs: number
  timestamp: string
  buildVersion: string
  profileVersion: string
  eventType: TrackingEventType
  data: TrackingEventData
}

interface RecordClock { nowMs?: number; wallClock?: string }

function assertJsonValue(value: unknown, path = 'data'): asserts value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return
  if (typeof value !== 'object') throw new TypeError(`${path} must contain only JSON values`)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`))
    return
  }
  const object = value as Record<string, unknown>
  if ('nodeType' in object || typeof object.getTracks === 'function' || typeof object.from === 'function') {
    throw new TypeError(`${path} contains a browser or service object`)
  }
  for (const [key, item] of Object.entries(object)) assertJsonValue(item, `${path}.${key}`)
}

export function createTrackingEvent(
  context: TrackingEventContext,
  eventType: TrackingEventType,
  data: TrackingEventData,
  clock: RecordClock = {},
): TrackingEvent {
  assertJsonValue(data)
  const nowMs = clock.nowMs ?? Date.now()
  return {
    attemptId: context.attemptId,
    movementId: context.movementId,
    movementName: context.movementName,
    elapsedMs: Math.max(0, nowMs - context.startedAtMs),
    timestamp: clock.wallClock ?? new Date(nowMs).toISOString(),
    buildVersion: context.buildVersion,
    profileVersion: context.profileVersion,
    eventType,
    data: JSON.parse(JSON.stringify(data)) as TrackingEventData,
  }
}

export class TrackingEventCollector {
  private events: TrackingEvent[] = []
  private lastPoseSampleAt: number | null = null
  private context: TrackingEventContext
  private readonly limit: number
  private readonly poseSampleIntervalMs: number

  constructor(context: TrackingEventContext, options: { limit?: number; poseSampleIntervalMs?: number } = {}) {
    this.context = context
    this.limit = options.limit ?? 2_500
    this.poseSampleIntervalMs = options.poseSampleIntervalMs ?? 500
  }

  updateContext(context: Partial<TrackingEventContext>) {
    this.context = { ...this.context, ...context }
  }

  record(eventType: TrackingEventType, data: TrackingEventData, clock: RecordClock = {}): boolean {
    const nowMs = clock.nowMs ?? Date.now()
    if (eventType === 'pose_sample' && this.lastPoseSampleAt !== null
      && nowMs - this.lastPoseSampleAt < this.poseSampleIntervalMs) return false
    if (eventType === 'pose_sample') this.lastPoseSampleAt = nowMs
    this.events.push(createTrackingEvent(this.context, eventType, data, { ...clock, nowMs }))
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit)
    return true
  }

  snapshot(): readonly TrackingEvent[] {
    return this.events.map(event => ({ ...event, data: { ...event.data } }))
  }

  toJSON(pretty = false): string {
    return JSON.stringify(this.events, null, pretty ? 2 : undefined)
  }
}
