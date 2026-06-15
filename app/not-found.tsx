import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sage to-sage-dark
                      flex items-center justify-center mx-auto mb-6
                      shadow-[0_8px_24px_rgba(90,125,110,.25)]">
        <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
          <path d="M22 6C22 6 13 15 13 24a9 9 0 0018 0c0-9-9-18-9-18z" fill="white" opacity=".95"/>
          <circle cx="22" cy="24" r="2.5" fill="rgba(255,255,255,.6)"/>
        </svg>
      </div>
      <h1 className="font-serif text-3xl font-medium text-charcoal mb-3">Page not found</h1>
      <p className="text-muted text-sm mb-8 max-w-xs leading-relaxed">
        This page doesn't exist. You might have followed a broken link or mistyped the URL.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/home" className="btn-primary w-full justify-center py-3.5">
          Go to home
        </Link>
        <Link href="/" className="btn-secondary w-full justify-center py-3.5">
          Back to Forma
        </Link>
      </div>
    </main>
  )
}
