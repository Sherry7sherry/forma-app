'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-cream"/>}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isPro        = searchParams.get('plan') === 'pro'

  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const errs: { email?: string; password?: string } = {}
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      // Friendlier error messages
      if (error.message.includes('invalid') || error.message.includes('email')) {
        setError('Please use a real inbox email address — we\'ll send you a confirmation.')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      // Preserve pro intent through onboarding
      const dest = isPro ? '/onboarding?plan=pro' : '/onboarding'
      router.push(dest)
      router.refresh()
    }
  }

  async function handleGoogle() {
    const redirectTo = isPro
      ? `${window.location.origin}/auth/callback?plan=pro`
      : `${window.location.origin}/auth/callback`
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 bg-cream">
      <Link href="/" className="absolute top-12 left-6 text-muted text-sm">← Back</Link>

      <div className="mb-8 fade-up">
        {isPro ? (
          <>
            <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/20
                            rounded-full px-3 py-1.5 text-xs font-semibold text-sage-dark mb-4">
              ✨ Pro trial
            </div>
            <h1 className="font-serif text-3xl font-medium mb-2">Create your account</h1>
            <p className="text-muted text-sm">Start your Pro trial — you'll review your plan before checkout.</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-medium mb-2">Start your practice</h1>
            <p className="text-muted text-sm">Free to join. No credit card required.</p>
          </>
        )}
      </div>

      <button onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl
                   border border-border bg-white text-sm font-medium text-charcoal
                   shadow-card mb-5 active:bg-cream-dark transition-all fade-up"
        style={{ animationDelay: '0.05s' }}>
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-5 fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="h-px flex-1 bg-border"/>
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-border"/>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-4 fade-up"
            style={{ animationDelay: '0.15s' }} noValidate>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal-mid">Your name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="First name is fine" required className="input-field" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal-mid">Email</label>
          <input type="email" value={email}
            onChange={e => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, email: undefined })) }}
            placeholder="you@example.com"
            className={`input-field ${fieldErrors.email ? 'border-rose' : ''}`} />
          {fieldErrors.email && <p className="text-xs text-rose-dark">{fieldErrors.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal-mid">Password</label>
          <input type="password" value={password}
            onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: undefined })) }}
            placeholder="At least 8 characters"
            className={`input-field ${fieldErrors.password ? 'border-rose' : ''}`} />
          {fieldErrors.password && <p className="text-xs text-rose-dark">{fieldErrors.password}</p>}
        </div>

        {error && (
          <div className="rounded-xl bg-rose/10 border border-rose/20 px-4 py-3 text-sm text-rose-dark">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="btn-primary w-full justify-center py-4 mt-1 disabled:opacity-60">
          {loading ? 'Creating account…' : isPro ? 'Continue to Pro setup' : 'Create free account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6 fade-up" style={{ animationDelay: '0.2s' }}>
        Already have an account?{' '}
        <Link href="/login" className="text-sage font-medium">Sign in</Link>
      </p>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
