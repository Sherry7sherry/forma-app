import Link from 'next/link'
import PublicLanguageSwitcher from '@/components/i18n/PublicLanguageSwitcher'
import type { Locale, MessageKey } from '@/lib/i18n'
import { translate } from '@/lib/i18n'

export default function LandingPage({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key)

  const howSteps: { num: string; title: MessageKey; desc: MessageKey }[] = [
    { num: '01', title: 'landing.how.bodyAssessment.title', desc: 'landing.how.bodyAssessment.desc' },
    { num: '02', title: 'landing.how.todayPlan.title', desc: 'landing.how.todayPlan.desc' },
    { num: '03', title: 'landing.how.aiCoaching.title', desc: 'landing.how.aiCoaching.desc' },
    { num: '04', title: 'landing.how.bodyProgress.title', desc: 'landing.how.bodyProgress.desc' },
  ]

  const features: { emoji: string; title: MessageKey; desc: MessageKey }[] = [
    { emoji: '📷', title: 'landing.features.aiFeedback.title', desc: 'landing.features.aiFeedback.desc' },
    { emoji: '🧭', title: 'landing.features.todayPlan.title', desc: 'landing.features.todayPlan.desc' },
    { emoji: '🧍‍♀️', title: 'landing.features.bodyAware.title', desc: 'landing.features.bodyAware.desc' },
    { emoji: '📈', title: 'landing.features.livingReport.title', desc: 'landing.features.livingReport.desc' },
    { emoji: '🎯', title: 'landing.features.personalizedFocus.title', desc: 'landing.features.personalizedFocus.desc' },
    { emoji: '🌿', title: 'landing.features.safetyAware.title', desc: 'landing.features.safetyAware.desc' },
  ]

  const previewStats: { value: MessageKey; label: MessageKey }[] = [
    { value: 'landing.preview.statToday', label: 'landing.preview.statPlan' },
    { value: 'landing.preview.statBody', label: 'landing.preview.statMirror' },
    { value: 'landing.preview.statLiving', label: 'landing.preview.statReport' },
  ]

  return (
    <main className="min-h-dvh bg-cream font-sans">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-2xl mx-auto">
        <div className="font-serif text-2xl font-medium text-charcoal">
          Forma<span className="text-sage">.</span>
        </div>
        <div className="flex items-center gap-3">
          <PublicLanguageSwitcher locale={locale} />
          <Link href="/login"
            className="text-sm font-medium text-charcoal-mid hover:text-charcoal transition-colors">
            {t('landing.signIn')}
          </Link>
          <Link href="/body-assessment"
            className="btn-primary py-2.5 px-5 text-sm">
            {t('landing.freeAssessment')}
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-10 pb-16 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/20
                        rounded-full px-4 py-1.5 text-xs font-semibold text-sage-dark
                        mb-6 uppercase tracking-widest">
          {t('landing.badge')}
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium text-charcoal
                       leading-tight mb-5">
          {t('landing.hero.title')}
        </h1>
        <p className="text-charcoal-mid text-lg leading-relaxed mb-8 max-w-md mx-auto">
          {t('landing.hero.body')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/body-assessment"
            className="btn-primary py-4 px-8 text-base justify-center">
            {t('landing.hero.primaryCta')}
          </Link>
          <Link href="#how-it-works"
            className="btn-secondary py-4 px-8 text-base justify-center">
            {t('landing.hero.secondaryCta')}
          </Link>
        </div>
        <p className="text-muted text-xs mt-4">{t('landing.hero.meta')}</p>
      </section>

      {/* ── App preview ── */}
      <section className="px-6 pb-16 max-w-sm mx-auto">
        <div className="bg-charcoal rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,.2)]">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-white/40 text-xs">{t('landing.preview.greeting')}</p>
              <p className="font-serif text-lg text-white">{t('landing.preview.welcome')}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-light to-rose
                            flex items-center justify-center font-serif text-white text-sm">S</div>
          </div>
          <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-sage-dark to-[#3D6B5A] p-5">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">{t('landing.preview.todayPlanLabel')}</p>
            <p className="font-serif text-lg text-white mb-3">{t('landing.preview.planTitle')}</p>
            <div className="flex gap-3 text-white/65 text-xs mb-4">
              <span>{t('landing.preview.duration')}</span>
              <span>{t('landing.preview.difficulty')}</span>
              <span>{t('landing.preview.matched')}</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white text-sage-dark
                            rounded-full px-4 py-2 text-xs font-semibold">
              {t('landing.preview.startSession')}
            </div>
          </div>
          <div className="mx-4 mb-4 rounded-2xl bg-[#1A1A1A] overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <div className="relative w-full h-full flex items-center justify-center">
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
              <div className="absolute top-2 left-2 right-2 flex justify-between">
                <div className="flex items-center gap-1 bg-black/50 rounded-full px-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>
                  <span className="text-white text-[9px] font-bold">{t('landing.preview.live')}</span>
                </div>
                <div className="bg-black/50 rounded-full px-2 py-1">
                  <span className="text-green-300 text-[9px] font-bold">{t('landing.preview.movementObserved')}</span>
                </div>
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                <div className="bg-sage/75 rounded-full px-2.5 py-1 text-white text-[9px] font-medium">{t('landing.preview.spineAligned')}</div>
                <div className="bg-amber-500/75 rounded-full px-2.5 py-1 text-white text-[9px] font-medium">{t('landing.preview.engageCore')}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mx-4 mb-5">
            {previewStats.map(stat => (
              <div key={stat.label} className="bg-white/8 rounded-xl py-2.5 text-center">
                <div className="font-serif text-base text-white">{t(stat.value)}</div>
                <div className="text-white/40 text-[9px]">{t(stat.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="px-6 py-16 bg-cream-dark">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">{t('landing.how.eyebrow')}</p>
          <h2 className="font-serif text-3xl text-charcoal text-center mb-10">
            {t('landing.how.title')}
          </h2>
          <div className="flex flex-col gap-6">
            {howSteps.map(s => (
              <div key={s.num} className="flex gap-5 items-start">
                <div className="font-serif text-3xl text-sage/30 font-medium flex-shrink-0 w-10">{s.num}</div>
                <div>
                  <h3 className="font-serif text-lg text-charcoal mb-1">{t(s.title)}</h3>
                  <p className="text-charcoal-mid text-sm leading-relaxed">{t(s.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-16 max-w-2xl mx-auto">
        <p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">{t('landing.features.eyebrow')}</p>
        <h2 className="font-serif text-3xl text-charcoal text-center mb-10">
          {t('landing.features.title')}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {features.map(f => (
            <div key={f.title} className="card">
              <div className="text-2xl mb-3">{f.emoji}</div>
              <h3 className="font-semibold text-sm text-charcoal mb-1">{t(f.title)}</h3>
              <p className="text-xs text-muted leading-relaxed">{t(f.desc)}</p>
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
          {t('landing.final.title')}
        </h2>
        <p className="text-charcoal-mid mb-8 max-w-sm mx-auto leading-relaxed">
          {t('landing.final.body')}
        </p>
        <Link href="/body-assessment"
          className="btn-primary py-4 px-10 text-base justify-center inline-flex">
          {t('landing.hero.primaryCta')}
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="font-serif text-lg text-charcoal">
            Forma<span className="text-sage">.</span>
          </div>
          <p className="text-xs text-muted">{t('landing.footer.copyright')}</p>
          <div className="flex gap-4 text-xs text-muted">
            <span className="text-muted">{t('landing.footer.privacy')}</span>
          </div>
        </div>
      </footer>

    </main>
  )
}
