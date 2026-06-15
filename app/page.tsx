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
          <Link href="/signup"
            className="btn-primary py-2.5 px-5 text-sm">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-10 pb-16 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/20
                        rounded-full px-4 py-1.5 text-xs font-semibold text-sage-dark
                        mb-6 uppercase tracking-widest">
          ✨ AI-powered Pilates coach
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium text-charcoal
                       leading-tight mb-5">
          Feel your progress{' '}<br/>
          <span className="text-sage">in every movement.</span>
        </h1>
        <p className="text-charcoal-mid text-lg leading-relaxed mb-8 max-w-md mx-auto">
          Forma uses your phone camera to watch your form in real time —
          like having a Pilates instructor in your pocket.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup"
            className="btn-primary py-4 px-8 text-base justify-center">
            Start for free
          </Link>
          <Link href="#how-it-works"
            className="btn-secondary py-4 px-8 text-base justify-center">
            See how it works
          </Link>
        </div>
        <p className="text-muted text-xs mt-4">Free to join · No credit card required</p>
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
                  <span className="text-green-300 text-[9px] font-bold">Form 87%</span>
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
            {[['4','Sessions'],['82%','Form avg'],['6 🔥','Streak']].map(([v,l]) => (
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
              { num: '01', title: 'Tell us your goals', desc: 'Recovery, alignment, strength, or flexibility — we build a plan around your body and history in 3 questions.' },
              { num: '02', title: 'Set up your phone', desc: 'We tell you exactly where to place your phone for each session — side view, distance, height. No guessing.' },
              { num: '03', title: 'Move with guidance', desc: 'Your camera watches your form in real time. The AI scores each movement and gives you instant feedback chips.' },
              { num: '04', title: 'See your progress', desc: 'After every session, get an AI coach summary, body insights, and a form score trend you can actually feel.' },
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
            { emoji: '📈', title: 'Visible progress', desc: 'Form scores, streaks, and body insights after every session' },
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

      {/* ── Pricing ── */}
      <section className="px-6 py-16 bg-cream-dark">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">Pricing</p>
          <h2 className="font-serif text-3xl text-charcoal text-center mb-10">Simple, honest pricing</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="card flex flex-col gap-4">
              <div>
                <div className="font-serif text-xl text-charcoal mb-1">Free</div>
                <div className="text-3xl font-serif text-charcoal">$0</div>
                <div className="text-muted text-xs mt-1">Forever free</div>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {['3 sessions per week','Video-guided exercises','Basic progress tracking'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-charcoal-mid">
                    <span className="text-sage text-base">✓</span>{f}
                  </li>
                ))}
                {['AI camera form analysis','Unlimited sessions'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted line-through">
                    <span className="text-border text-base">✗</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-secondary w-full justify-center py-3">
                Get started free
              </Link>
            </div>
            {/* Pro */}
            <div className="card flex flex-col gap-4 border-sage bg-gradient-to-br from-sage/5 to-transparent relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-sage text-white text-[10px] font-bold
                              px-2.5 py-1 rounded-full uppercase tracking-wide">
                Popular
              </div>
              <div>
                <div className="font-serif text-xl text-charcoal mb-1">Pro</div>
                <div className="text-3xl font-serif text-charcoal">$14.99
                  <span className="text-base text-muted font-sans">/mo</span>
                </div>
                <div className="text-muted text-xs mt-1">or $99/year — save 45%</div>
              </div>
              <ul className="flex flex-col gap-2 flex-1">
                {['Unlimited sessions','Real-time AI form analysis','Full progress & body insights','All session types & programs','AI coach post-session feedback'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-charcoal-mid">
                    <span className="text-sage text-base">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=pro" className="btn-primary w-full justify-center py-3">
                Start Pro free trial
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-muted mt-4">
            🌟 Founding member offer: $59/year for the first 200 members
          </p>
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
          Join Forma and start your first session in under 5 minutes.
          Your body will thank you.
        </p>
        <Link href="/signup"
          className="btn-primary py-4 px-10 text-base justify-center inline-flex">
          Get started free
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
