'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import HealthNoticeContent from '@/components/disclaimer/HealthNoticeContent'

export default function DisclaimerGateForm({
  showRecoveryReminder,
  next,
  reviewMode,
}: {
  showRecoveryReminder: boolean
  next: string
  reviewMode?: boolean
}) {
  const router  = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleContinue() {
    if (!agreed || saving) return
    setSaving(true)
    setError(null)

    // Hard timeout so the button can never get stuck on "Saving…" — if the
    // request hasn't resolved in 15s, abort and show a retryable error.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch('/api/disclaimer/accept', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      // If the request was redirected (e.g. to an HTML page) it never hit the
      // handler — treat that as a failure instead of silently hanging.
      if (res.redirected || !res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Couldn't save (status ${res.status}). Please try again.`)
        setSaving(false)
        return
      }
    } catch (err: any) {
      setError(
        err?.name === 'AbortError'
          ? 'This is taking too long. Check your connection and try again.'
          : 'Network error — please check your connection and try again.'
      )
      setSaving(false)
      return
    } finally {
      clearTimeout(timeout)
    }

    router.push(next)
    router.refresh()
  }

  return (
    <main className="min-h-dvh bg-cream flex flex-col">
      <div className="flex items-center px-5 pt-14 pb-2">
        {reviewMode
          ? <button className="btn-ghost px-0 text-sm" onClick={() => router.back()}>← Back</button>
          : <p className="text-xs font-semibold text-sage uppercase tracking-widest">Before you begin</p>}
      </div>

      <div className="flex-1 px-5 pb-40 overflow-y-auto fade-up">
        <HealthNoticeContent showRecoveryReminder={showRecoveryReminder} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4
                      bg-gradient-to-t from-cream via-cream to-transparent w-full max-w-lg mx-auto">
        {reviewMode ? (
          <button onClick={() => router.back()}
            className="btn-primary w-full justify-center py-4 text-base">
            Close
          </button>
        ) : (
          <>
            <label htmlFor="disclaimer-agree"
              className="flex items-start gap-3 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                id="disclaimer-agree"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-sage flex-shrink-0 cursor-pointer"
              />
              <span className="text-sm text-charcoal leading-snug">
                I understand and agree to the health and safety notice.
              </span>
            </label>

            {error && (
              <p className="text-xs text-red-600 mb-3 px-1">
                {error}
              </p>
            )}

            <button
              disabled={!agreed || saving}
              onClick={handleContinue}
              className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40">
              {saving ? 'Saving…' : 'Continue'}
            </button>

            <p className="text-center text-xs text-muted mt-3">
              <span className="opacity-60">View full Terms · coming soon</span>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
