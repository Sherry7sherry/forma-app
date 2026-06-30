'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { buildBodyCheckInInsert } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/client'

const COMFORT_OPTIONS = [
  { value: 1, label: 'Very uncomfortable' },
  { value: 2, label: 'Uncomfortable' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Comfortable' },
  { value: 5, label: 'Very comfortable' },
] as const

const FOCUS_AREAS = [
  { value: 'neck_shoulders', label: 'Neck & shoulders' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'hips', label: 'Hips' },
] as const

const SAFETY_SIGNALS = [
  { value: 'sharp_pain', label: 'Sharp pain' },
  { value: 'numbness', label: 'Numbness' },
  { value: 'radiating_pain', label: 'Radiating pain' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'chest_pain', label: 'Chest pain' },
  { value: 'shortness_of_breath', label: 'Shortness of breath' },
  { value: 'sudden_weakness', label: 'Sudden weakness' },
] as const

interface Props {
  userId: string
  label?: string
  className?: string
}

export default function BodyCheckInSheet({
  userId,
  label = 'Check in now',
  className = 'btn-primary',
}: Props) {
  const router = useRouter()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [comfort, setComfort] = useState<number | null>(null)
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [safetySignals, setSafetySignals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  function toggle(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value])
  }

  async function submitCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (comfort === null || saving) return
    setSaving(true)
    setError(null)
    try {
      const row = buildBodyCheckInInsert({ userId, comfort, focusAreas, safetySignals })
      const { error: insertError } = await createClient().from('body_check_ins').insert(row)
      if (insertError) throw insertError
      setIsOpen(false)
      setComfort(null)
      setFocusAreas([])
      setSafetySignals([])
      router.refresh()
    } catch {
      setError('Your check-in could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setIsOpen(true)}>
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 px-0 sm:px-4"
          onMouseDown={event => {
            if (event.currentTarget === event.target) setIsOpen(false)
          }}>
          <section role="dialog" aria-modal="true" aria-labelledby="body-check-in-title"
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-4xl bg-cream px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-4xl sm:mb-4">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">15-second check-in</p>
                <h2 id="body-check-in-title" className="font-serif text-2xl">How does your body feel?</h2>
                <p className="mt-1 text-sm text-muted">This is a self-report, not a diagnosis.</p>
              </div>
              <button ref={closeButtonRef} type="button" aria-label="Close body check-in"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-white text-charcoal-mid focus:outline-none focus:ring-2 focus:ring-sage/40">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submitCheckIn}>
              <fieldset>
                <legend className="text-sm font-semibold text-charcoal">Overall comfort right now</legend>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {COMFORT_OPTIONS.map(option => (
                    <button key={option.value} type="button" aria-pressed={comfort === option.value}
                      aria-label={`${option.value} out of 5: ${option.label}`}
                      onClick={() => setComfort(option.value)}
                      className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sage/40
                        ${comfort === option.value ? 'border-sage bg-sage text-white' : 'border-border bg-white text-charcoal-mid'}`}>
                      <span className="font-serif text-lg">{option.value}</span>
                      <span className="sr-only">{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted">
                  <span>Uncomfortable</span><span>Comfortable</span>
                </div>
              </fieldset>

              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-charcoal">Where do you notice it?</legend>
                <p className="mt-1 text-xs text-muted">Optional — choose any that apply.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FOCUS_AREAS.map(area => {
                    const selected = focusAreas.includes(area.value)
                    return (
                      <button key={area.value} type="button" aria-pressed={selected}
                        onClick={() => toggle(area.value, focusAreas, setFocusAreas)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage/40
                          ${selected ? 'border-sage bg-sage/15 text-sage-dark' : 'border-border bg-white text-charcoal-mid'}`}>
                        {selected && <Check size={14} aria-hidden="true" />}{area.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset className="mt-6 rounded-2xl border border-rose/30 bg-rose/10 p-4">
                <legend className="px-1 text-sm font-semibold text-charcoal">Any stop signals right now?</legend>
                <p className="mt-1 flex gap-2 text-xs leading-relaxed text-charcoal-mid">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-rose-dark" aria-hidden="true" />
                  Selecting one will pause exercise recommendations.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SAFETY_SIGNALS.map(signal => {
                    const selected = safetySignals.includes(signal.value)
                    return (
                      <button key={signal.value} type="button" aria-pressed={selected}
                        onClick={() => toggle(signal.value, safetySignals, setSafetySignals)}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose/40
                          ${selected ? 'border-rose-dark bg-white text-rose-dark' : 'border-rose/20 bg-white/70 text-charcoal-mid'}`}>
                        {signal.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-dark">{error}</p>}

              <button type="submit" disabled={comfort === null || saving}
                className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-45">
                {saving ? 'Saving…' : safetySignals.length ? 'Save and pause recommendations' : 'Save check-in'}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
