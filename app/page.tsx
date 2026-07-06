import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-cream font-sans">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-2xl mx-auto">
        <div className="font-serif text-2xl font-medium text-charcoal">
          Forma<span className="text-sage">.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm font-medium text-charcoal-mid hover:text-charcoal transition-colors">
            Sign in
          </Link>
          <Link href="/body-assessment"
            className="btn-primary py-2.5 px-5 text-sm">
            Free assessment
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-10 pb-16 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/20
                        rounded-full px-4 py-1.5 text-xs font-semibold text-sage-dark
                        mb-6 uppercase tracking-widest">
          Personal Body Mirror
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium text-charcoal
                       leading-tight mb-5">
          In four minutes, learn what kind of movement fits your body today.
        </h1>
        <p className="text-charcoal-mid text-lg leading-relaxed mb-8 max-w-md mx-auto">
          Combine your body history, everyday habits, and three simple movements to see one free personal insight before you decide what comes next.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/body-assessment"
            className="btn-primary py-4 px-8 text-base justify-center">
            Start my free body assessment
          </Link>
          <Link href="#how-it-works"
            className="btn-secondary py-4 px-8 text-base justify-center">
            See how it works
          </Link>
        </div>
        <p className="text-muted text-xs mt-4">About four minutes · No mat · No account needed to start</p>
      </section>

      {/* ── App preview ── */}
      <section className="px-6 pb-16 max-w-sm mx-auto">
        <div className="bg-charcoal rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,.2)]">
          {/* Fake phone top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-white/40 text-xs">Good morning ✨</p>
              <p className="font-serif text-lg text-white">Welcome back</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-light to-rose
                            flex items-center justify-center font-serif text-white text-sm">S</div>
          </div>
          {/* Session card */}
          <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-sage-dark to-[#3D6B5A] p-5">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Today's session</p>
            <p className="font-serif text-lg text-white mb-3">Spinal Mobility & Deep Core</p>
            <div className="flex gap-3 text-white/65 text-xs mb-4">
              <span>⏱ 28 min</span>
              <span>⚡ Moderate</span>
              <span>💚 Recovery</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white text-sage-dark
                            rounded-full px-4 py-2 text-xs font-semibold">
              ▶ Start session
            </div>
          </div>
          {/* AI camera preview */}
          <div className="mx-4 mb-4 rounded-2xl bg-[#1A1A1A] overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Skeleton figure */}
              <svg viewBox="0 0 200 150" className="w-full h-full opacity-80">
                <g stroke="rgba(168,197,181,.85)" strokeWidth="2" strokeLinecap="round" fill="none">
                  <circle cx="100" cy="20" r="10"/>
                  <line x1="100" y1="30" x2="100" y2="70"/>
                  <line x1="70" y1="45" x2="130" y2="45"/>
                  <line x1="70" y1="45" x2="55" y2="70"/>
                  <line x1="130" y1="45" x2="145" y2="70"/>
                  <line x1="85" y1="70" x2="115" y2="70"/>
                  <line x1="85" y1="70" x2="78" y2="105"/>
                  <line x1="78" y1="105" x2="78" y2="130"/>
                  <line x1="115" y1="70" x2="122" y2="105"/>
                  <line x1="122" y1="105" x2="122" y2="130"/>
                </g>
                <g fill="rgba(168,197,181,.9)">
                  <circle cx="100" cy="45" r="3"/>
                  <circle cx="70" cy="45" r="3"/>
                  <circle cx="130" cy="45" r="3"/>
                  <circle cx="100" cy="70" r="3"/>
                </g>
              </svg>
              {/* HUD overlay */}
              <div className="absolute top-2 left-2 right-2 flex justify-between">
                <div className="flex items-center gap-1 bg-black/50 rounded-full px-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>
                  <span className="text-white text-[9px] font-bold">LIVE</span>
                </div>
                <div className="bg-black/50 rounded-full px-2 py-1">
                  <span className="text-green-300 text-[9px] font-bold">Movement observed</span>
                </div>
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                <div className="bg-sage/75 rounded-full px-2.5 py-1 text-white text-[9px] font-medium">Spine aligned ✓</div>
                <div className="bg-amber-500/75 rounded-full px-2.5 py-1 text-white text-[9px] font-medium">Engage core ↑</div>
              </div>
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mx-4 mb-5">
            {[['Fresh','Body data'],['Personal','Baseline'],['2 wk','Recheck']].map(([v,l]) => (
              <div key={l} className="bg-white/8 rounded-xl py-2.5 text-center">
                <div className="font-serif text-base text-white">{v}</div>
                <div className="text-white/40 text-[9px]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="px-6 py-16 bg-cream-dark">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">How it works</p>
          <h2 className="font-serif text-3xl text-charcoal text-center mb-10">
            Your AI coach watches so you don't have to guess
          </h2>
          <div className="flex flex-col gap-6">
            {[
              { num: '01', title: 'Tell us your context', desc: 'Six quick choices cover goals, body focus, relevant history, habits, work pattern, and available time.' },
              { num: '02', title: 'Set up your phone', desc: 'We tell you exactly where to place your phone for each session — side view, distance, height. No guessing.' },
              { num: '03', title: 'Move with guidance', desc: 'Three simple movements create confidence-qualified observations without uploading raw video.' },
              { num: '04', title: 'See your progress', desc: 'Track comfort, mobility, and movement control against your own baseline over time.' },
            ].map(s => (
              <div key={s.num} className="flex gap-5 items-start">
                <div className="font-serif text-3xl text-sage/30 font-medium flex-shrink-0 w-10">{s.num}</div>
                <div>
                  <h3 className="font-serif text-lg text-charcoal mb-1">{s.title}</h3>
                  <p className="text-charcoal-mid text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-16 max-w-2xl mx-auto">
        <p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">Built for recovery</p>
        <h2 className="font-serif text-3xl text-charcoal text-center mb-10">
          Not a generic fitness app
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { emoji: '📷', title: 'Real-time AI form', desc: 'MediaPipe pose detection scores your alignment as you move' },
            { emoji: '🌿', title: 'Recovery-first', desc: 'Every session designed around healing, not just burning calories' },
            { emoji: '🧍‍♀️', title: 'Posture & alignment', desc: 'Specific feedback on spine, hips, shoulders — what actually matters' },
            { emoji: '📈', title: 'Visible progress', desc: 'Comfort, mobility, and movement control compared only with your baseline' },
            { emoji: '🎯', title: 'Personalised plan', desc: '30 Pilates exercises sequenced to your goals and focus areas' },
            { emoji: '💬', title: 'AI coach feedback', desc: 'Post-session summary written to your specific session performance' },
          ].map(f => (
            <div key={f.title} className="card">
              <div className="text-2xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold text-sm text-charcoal mb-1">{f.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 py-20 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sage to-sage-dark
                        flex items-center justify-center mx-auto mb-6
                        shadow-[0_8px_24px_rgba(90,125,110,.3)]">
          <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
            <path d="M22 6C22 6 13 15 13 24a9 9 0 0018 0c0-9-9-18-9-18z" fill="white" opacity=".95"/>
            <circle cx="22" cy="24" r="2.5" fill="rgba(255,255,255,.6)"/>
          </svg>
        </div>
        <h2 className="font-serif text-3xl text-charcoal mb-4">
          Ready to feel the difference?
        </h2>
        <p className="text-charcoal-mid mb-8 max-w-sm mx-auto leading-relaxed">
          Start with one clear body insight. Create an account only if you choose to save your starting point.
        </p>
        <Link href="/body-assessment"
          className="btn-primary py-4 px-10 text-base justify-center inline-flex">
          Start my free body assessment
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="font-serif text-lg text-charcoal">
            Forma<span className="text-sage">.</span>
          </div>
          <p className="text-xs text-muted">© 2026 Forma. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-muted">
            <span className="text-muted">Privacy · coming soon</span>
          </div>
        </div>
      </footer>

    </main>
  )
}
