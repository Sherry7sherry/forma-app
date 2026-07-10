'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { assertSupabaseSuccess } from '@/lib/supabaseErrors'
import type { Goal, ExperienceLevel, FocusArea } from '@/types'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STEPS = 4

const LANGUAGE_OPTIONS: { locale: Locale; label: string; desc: string }[] = [
  { locale: 'en-US', label: 'English', desc: 'Use English for app screens, voice cues, and coach summaries.' },
  { locale: 'zh-CN', label: '中文', desc: '使用中文显示界面、语音提示和训练总结。' },
]

const GOALS: { id: Goal; emoji: string; name: string; desc: string }[] = [
  { id: 'recovery',    emoji: '🌿', name: 'Recovery',    desc: 'Heal after injury, birth, or surgery' },
  { id: 'alignment',   emoji: '🧍‍♀️', name: 'Alignment',   desc: 'Improve posture and body mechanics' },
  { id: 'strength',    emoji: '💪', name: 'Strength',    desc: 'Build deep core and functional strength' },
  { id: 'flexibility', emoji: '🧘‍♀️', name: 'Flexibility', desc: 'Lengthen and release tension' },
]

const LEVELS: { id: ExperienceLevel; name: string; desc: string }[] = [
  { id: 'beginner', name: 'Just starting out',   desc: 'Little or no structured movement experience' },
  { id: 'some',     name: 'Some experience',      desc: 'Occasional yoga, gym, or fitness classes' },
  { id: 'regular',  name: 'Regular mover',        desc: 'Consistent weekly practice, know Pilates basics' },
  { id: 'advanced', name: 'Advanced',             desc: 'Strong body awareness, want precision work' },
]

const FOCUS_AREAS: { id: FocusArea; emoji: string; name: string }[] = [
  { id: 'lower_back',     emoji: '🔲', name: 'Lower back' },
  { id: 'neck_shoulders', emoji: '🔷', name: 'Neck & shoulders' },
  { id: 'hips',           emoji: '⬡',  name: 'Hips' },
  { id: 'core_pelvic',    emoji: '🔵', name: 'Core & pelvic floor' },
  { id: 'knees',          emoji: '🟢', name: 'Knees' },
  { id: 'ankles_feet',    emoji: '🟤', name: 'Ankles & feet' },
]

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-cream"/>}>
      <OnboardingForm />
    </Suspense>
  )
}

function OnboardingForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isPro        = searchParams.get('plan') === 'pro'
  const supabase     = createClient()

  const [step, setStep]           = useState(1)
  const [locale, setLocale]       = useState<Locale | null>(null)
  const [goals, setGoals]         = useState<Goal[]>([])
  const [level, setLevel]         = useState<ExperienceLevel | null>(null)
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function toggleGoal(g: Goal) {
    setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }
  function toggleFocus(f: FocusArea) {
    setFocusAreas(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      if (!locale) throw new Error('Choose a language before continuing.')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in again before finishing onboarding.')

      const onboardingResult = await supabase.from('user_onboarding').upsert({
        user_id:          user.id,
        goals,
        experience_level: level,
        focus_areas:      focusAreas,
        sessions_per_week: 3,
      })
      assertSupabaseSuccess(onboardingResult, 'Save onboarding')

      const profileResult = await supabase.from('user_profiles')
        .update({ onboarding_completed: true, preferred_locale: locale })
        .eq('id', user.id)
      assertSupabaseSuccess(profileResult, 'Complete onboarding')

      // If user came from Pro CTA, send straight to checkout. Checkout is a POST
      // (side-effecting) route, so submit a form rather than navigating via GET.
      if (isPro) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/api/stripe/checkout?plan=monthly'
        document.body.appendChild(form)
        form.submit()
      } else {
        router.push('/home')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish onboarding.')
      setSaving(false)
    }
  }

  return (
    <main className="min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2">
        {step > 1
          ? <button className="btn-ghost px-0 text-sm" onClick={() => setStep(s => s - 1)}>← Back</button>
          : <div/>}
        {/* Progress dots */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className={cn(
              'h-1 rounded-full transition-all duration-300',
              i + 1 < step  ? 'w-5 bg-sage-light' :
              i + 1 === step ? 'w-8 bg-sage' :
                               'w-5 bg-border'
            )}/>
          ))}
        </div>
        <div className="w-12"/>
      </div>

      {/* Step 1 — Language */}
      {step === 1 && (
        <div className="flex-1 px-5 pt-8 pb-32 fade-up">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest mb-2">Step 1 of 4</p>
          <h2 className="font-serif text-2xl font-medium mb-2">Choose your coaching language</h2>
          <p className="text-muted text-sm mb-8">Forma will use this for your app, voice cues, and coach summaries.</p>
          <div className="flex flex-col gap-3">
            {LANGUAGE_OPTIONS.map(option => (
              <button
                key={option.locale}
                type="button"
                onClick={() => setLocale(option.locale)}
                className={cn(
                  'border rounded-2xl p-4 text-left cursor-pointer transition-all duration-200 active:scale-[.98] flex items-center gap-4',
                  locale === option.locale ? 'border-sage bg-sage/7' : 'border-border bg-white'
                )}>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  locale === option.locale ? 'border-sage bg-sage' : 'border-border'
                )}>
                  {locale === option.locale && <div className="w-2 h-2 rounded-full bg-white"/>}
                </div>
                <div>
                  <div className="font-semibold text-sm text-charcoal">{option.label}</div>
                  <div className="text-xs text-muted mt-0.5">{option.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Goals */}
      {step === 2 && (
        <div className="flex-1 px-5 pt-8 pb-32 fade-up">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest mb-2">Step 2 of 4</p>
          <h2 className="font-serif text-2xl font-medium mb-2">What are your goals?</h2>
          <p className="text-muted text-sm mb-8">Choose everything that feels right.</p>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map(g => (
              <div key={g.id}
                onClick={() => toggleGoal(g.id)}
                className={cn(
                  'border rounded-2xl p-4 cursor-pointer transition-all duration-200 active:scale-[.97]',
                  goals.includes(g.id)
                    ? 'border-sage bg-sage/7 shadow-[0_0_0_3px_rgba(122,158,142,.15)]'
                    : 'border-border bg-white'
                )}>
                <div className="text-2xl mb-2">{g.emoji}</div>
                <div className="font-semibold text-sm text-charcoal mb-1">{g.name}</div>
                <div className="text-xs text-muted leading-snug">{g.desc}</div>
              </div>
            ))}
          </div>
          {goals.includes('recovery') && (
            <div className="mt-4 rounded-2xl border border-sage/30 bg-sage/7 p-4">
              <p className="text-xs text-charcoal leading-relaxed">
                🌿 Because you selected recovery or pain-related goals, please move gently and
                consult a clinician if symptoms are acute or severe.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Experience Level */}
      {step === 3 && (
        <div className="flex-1 px-5 pt-8 pb-32 fade-up">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest mb-2">Step 3 of 4</p>
          <h2 className="font-serif text-2xl font-medium mb-2">Your movement experience?</h2>
          <p className="text-muted text-sm mb-8">We adjust in real time anyway.</p>
          <div className="flex flex-col gap-3">
            {LEVELS.map(l => (
              <div key={l.id}
                onClick={() => setLevel(l.id)}
                className={cn(
                  'border rounded-2xl p-4 cursor-pointer transition-all duration-200 active:scale-[.98] flex items-center gap-4',
                  level === l.id ? 'border-sage bg-sage/7' : 'border-border bg-white'
                )}>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  level === l.id ? 'border-sage bg-sage' : 'border-border'
                )}>
                  {level === l.id && <div className="w-2 h-2 rounded-full bg-white"/>}
                </div>
                <div>
                  <div className="font-semibold text-sm text-charcoal">{l.name}</div>
                  <div className="text-xs text-muted mt-0.5">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 — Focus Areas */}
      {step === 4 && (
        <div className="flex-1 px-5 pt-8 pb-32 fade-up">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest mb-2">Step 4 of 4</p>
          <h2 className="font-serif text-2xl font-medium mb-2">Any areas to focus on?</h2>
          <p className="text-muted text-sm mb-8">We'll monitor these during sessions. Select any that apply.</p>
          <div className="grid grid-cols-2 gap-3">
            {FOCUS_AREAS.map(f => (
              <div key={f.id}
                onClick={() => toggleFocus(f.id)}
                className={cn(
                  'border rounded-2xl p-4 cursor-pointer transition-all duration-200 active:scale-[.97] flex flex-col items-center gap-2 text-center',
                  focusAreas.includes(f.id)
                    ? 'border-rose bg-rose/7' : 'border-border bg-white'
                )}>
                <div className="text-2xl">{f.emoji}</div>
                <div className="font-semibold text-sm text-charcoal">{f.name}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">Not sure? Leave blank — we'll adapt over time.</p>
        </div>
      )}

      {error && (
        <div className="fixed left-5 right-5 bottom-28 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">
          {error}
        </div>
      )}

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4
                      bg-gradient-to-t from-cream via-cream to-transparent">
        {step < STEPS ? (
          <button
            disabled={step === 1 && locale === null || step === 2 && goals.length === 0 || step === 3 && !level}
            className="btn-primary w-full justify-center py-4 text-base disabled:opacity-40"
            onClick={() => setStep(s => s + 1)}>
            Continue
          </button>
        ) : (
          <button
            disabled={saving}
            className="btn-primary w-full justify-center py-4 text-base disabled:opacity-60"
            onClick={finish}>
            {saving ? 'Building your plan…' : isPro ? 'Continue to checkout →' : 'Build my plan →'}
          </button>
        )}
      </div>
    </main>
  )
}
