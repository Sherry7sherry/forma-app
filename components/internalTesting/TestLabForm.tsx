'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { TESTABLE_MOVEMENTS } from '@/lib/internalTesting/movementRegistry'
import { serializeTestScenario, type TestScenarioPhase } from '@/lib/internalTesting/scenarios'

const ADVANCED_JUMP_PHASES: TestScenarioPhase[] = ['capture', 'calibrating', 'exercising']

export function TestLabForm() {
  const router = useRouter()
  const [movementId, setMovementId] = useState(TESTABLE_MOVEMENTS[0].id)
  const [phase, setPhase] = useState<TestScenarioPhase>('full-run')
  const [scenarioId, setScenarioId] = useState(TESTABLE_MOVEMENTS[0].scenarios[0].id)
  const [repeats, setRepeats] = useState(1)

  const movement = TESTABLE_MOVEMENTS.find(item => item.id === movementId) ?? TESTABLE_MOVEMENTS[0]
  const isFullRun = phase === 'full-run'

  function selectMovement(id: string) {
    const entry = TESTABLE_MOVEMENTS.find(item => item.id === id)!
    setMovementId(id)
    setScenarioId(entry.scenarios[0].id)
    setPhase('full-run')
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={event => {
        event.preventDefault()
        router.push(`/internal/test-lab/run?${serializeTestScenario({ movementId, phase, scenarioId, repeats })}`)
      }}
    >
      <label>
        Movement
        <select
          value={movementId}
          onChange={event => selectMovement(event.target.value)}
          className="mt-1 w-full rounded-xl border p-2"
        >
          {TESTABLE_MOVEMENTS.map(item => (
            <option value={item.id} key={item.id}>{item.kind} · {item.displayName}</option>
          ))}
        </select>
      </label>

      <div className="rounded-2xl border border-sage/20 bg-sage/10 p-4 text-sm text-charcoal-mid">
        <p className="font-semibold text-charcoal">Default: full movement test</p>
        <p className="mt-1">
          Start normally and label what happened after observing the run. Testers do not need to guess
          camera placement, calibration, or counting failures up front.
        </p>
      </div>

      <label>
        Target reps
        <input
          type="number"
          min={1}
          max={20}
          value={repeats}
          onChange={event => setRepeats(Number(event.target.value))}
          className="mt-1 w-full rounded-xl border p-2"
        />
      </label>

      <details className="rounded-2xl border border-charcoal/10 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-charcoal">Advanced jump</summary>
        <div className="mt-4 grid gap-4">
          <label>
            Jump target
            <select
              value={phase === 'full-run' ? '' : phase}
              onChange={event => setPhase((event.target.value || 'full-run') as TestScenarioPhase)}
              className="mt-1 w-full rounded-xl border p-2"
            >
              <option value="">No jump — full run</option>
              {ADVANCED_JUMP_PHASES.map(item => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Expected signal
            <select
              value={scenarioId}
              onChange={event => setScenarioId(event.target.value)}
              className="mt-1 w-full rounded-xl border p-2"
            >
              {movement.scenarios.map(item => (
                <option value={item.id} key={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <button className="btn-primary" type="submit">
        {isFullRun ? 'Start full test' : 'Start advanced jump'}
      </button>
    </form>
  )
}
