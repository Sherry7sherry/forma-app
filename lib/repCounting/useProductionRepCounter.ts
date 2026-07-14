'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ExerciseTrackingProfile } from '../exerciseTracking'
import type { PoseResult } from '@/components/camera/PoseCamera'
import {
  createProductionRepCounterState,
  describeAiRepStatus,
  processProductionRepPose,
  repCycleStage,
  type ProductionRepCounterEvent,
  type ProductionRepCounterState,
} from './productionRepCounter'

interface UseProductionRepCounterOptions {
  exerciseName: string | undefined
  trackingProfile: ExerciseTrackingProfile
  targetReps: number
  enabled: boolean
  onCount?(event: ProductionRepCounterEvent): void | Promise<void>
  onEvent?(event: ProductionRepCounterEvent): void | Promise<void>
}

export type ProductionRepCounterView = ProductionRepCounterState & {
  status: ReturnType<typeof describeAiRepStatus>
  cycleStage: ReturnType<typeof repCycleStage>
  processPose(result: Pick<PoseResult, 'framingStatus' | 'landmarks' | 'bodyConfidence'>): void
  reset(initialRepCount?: number): void
  setCount(count: number): void
}

export function useProductionRepCounter({
  exerciseName,
  trackingProfile,
  targetReps,
  enabled,
  onCount,
  onEvent,
}: UseProductionRepCounterOptions): ProductionRepCounterView {
  const [state, setState] = useState(() => createProductionRepCounterState({ mode: trackingProfile.mode, targetReps }))
  const stateRef = useRef(state)
  const onCountRef = useRef(onCount)
  const onEventRef = useRef(onEvent)

  useEffect(() => { onCountRef.current = onCount }, [onCount])
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const reset = useCallback((initialRepCount = 0) => {
    const next = createProductionRepCounterState({ mode: trackingProfile.mode, targetReps, initialRepCount })
    stateRef.current = next
    setState(next)
  }, [targetReps, trackingProfile.mode])

  const setCount = useCallback((count: number) => {
    const next = { ...stateRef.current, repCount: Math.max(0, Math.min(targetReps, count)) }
    stateRef.current = next
    setState(next)
  }, [targetReps])

  useEffect(() => {
    reset()
  }, [exerciseName, reset])

  const processPose = useCallback((result: Pick<PoseResult, 'framingStatus' | 'landmarks' | 'bodyConfidence'>) => {
    if (!enabled) return
    const output = processProductionRepPose(stateRef.current, {
      framingStatus: result.framingStatus,
      landmarks: result.landmarks,
      bodyConfidence: result.bodyConfidence,
    }, {
      exerciseName,
      trackingProfile,
      targetReps,
      nowMs: Date.now(),
    })
    stateRef.current = output.state
    setState(output.state)
    for (const event of output.events) {
      void onEventRef.current?.(event)
      if (event.type === 'count') void onCountRef.current?.(event)
    }
  }, [enabled, exerciseName, targetReps, trackingProfile])

  const status = useMemo(
    () => describeAiRepStatus(state.phase, state.framingDetail, state.movementStale),
    [state.framingDetail, state.movementStale, state.phase],
  )
  const cycleStage = useMemo(() => repCycleStage(state.phase), [state.phase])

  return { ...state, status, cycleStage, processPose, reset, setCount }
}
