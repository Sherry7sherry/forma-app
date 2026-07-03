import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Camera,
  FileCheck2,
  HeartHandshake,
  Lightbulb,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldCheck,
} from 'lucide-react'

import { partitionReportSections, type AssessmentReport, type AssessmentReportSection } from '@/lib/assessmentReport'

export default function AssessmentReportView({
  report,
  error,
  quickPlanId,
}: {
  report: AssessmentReport | null
  error: string | null
  quickPlanId: string | null
}) {
  if (!report) return <EmptyReport error={error} />

  const { free, paid } = partitionReportSections(report)
  const evidenceSections = free.filter(section => section.evidenceIds.length > 0)
  const evidenceCount = new Set(evidenceSections.flatMap(section => section.evidenceIds)).size
  const reportDate = formatDate(report.generatedAt)
  const assessmentDate = report.assessmentAsOf ? formatDate(report.assessmentAsOf) : 'Not available'

  return (
    <div className="fade-up pb-8 text-charcoal">
      <header className="px-5 pb-6 pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage-dark">Personal Body Mirror</p>
        <h1 className="mt-2 font-serif text-3xl">Your body report</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-charcoal-mid">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5"><CalendarDays size={13} aria-hidden="true" /> {reportDate}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5"><Camera size={13} aria-hidden="true" /> Evidence from {assessmentDate}</span>
        </div>
      </header>

      {report.status === 'safety_hold' && (
        <section className="px-5" aria-labelledby="safety-report-heading">
          <div className="rounded-4xl border border-rose/30 bg-rose/10 p-5">
            <AlertTriangle size={26} className="text-rose-dark" aria-hidden="true" />
            <h2 id="safety-report-heading" className="mt-4 font-serif text-2xl">Movement is paused for now.</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">Your latest safety context takes priority. Keep movement paused and seek appropriate support if the signal is new, severe, or worsening.</p>
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-4 px-5" aria-label="Free body report">
        {free.map(section => <FreeSection key={section.id} section={section} />)}
      </section>

      <section className="mx-5 mt-5 rounded-3xl border border-border bg-white p-5" aria-labelledby="report-evidence-heading">
        <div className="flex items-center gap-2 text-sage-dark"><FileCheck2 size={18} aria-hidden="true" /><h2 id="report-evidence-heading" className="text-sm font-semibold">Confidence and evidence</h2></div>
        <p className="mt-3 text-xs leading-relaxed text-charcoal-mid">
          This report uses your questionnaire context and {evidenceCount} camera-derived movement observations. Conclusions require reliable evidence and compare only with your own future baseline.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Raw video is not part of this report. Forma describes movement observations and does not provide a diagnosis.</p>
      </section>

      {report.status === 'insufficient_evidence' && (
        <section className="px-5 pt-5">
          <div className="rounded-3xl border border-sage/20 bg-sage/10 p-5">
            <RefreshCw size={22} className="text-sage-dark" aria-hidden="true" />
            <h2 className="mt-3 font-serif text-xl">A clearer camera check can complete this report.</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">No missing insight has been replaced with a generic conclusion.</p>
            <Link href="/assessment" className="btn-primary mt-5 w-full">Retry camera assessment</Link>
          </div>
        </section>
      )}

      {report.status !== 'safety_hold' && report.status !== 'insufficient_evidence' && (
        <>
          <section className="mt-7 px-5" aria-labelledby="report-path-heading">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-dark">Your adapting path</p>
            <h2 id="report-path-heading" className="mt-2 font-serif text-2xl">What Forma can build from here</h2>
            <div className="mt-4 grid gap-3">
              {paid.map(section => (
                <article key={section.id} className="rounded-3xl border border-border bg-white p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-sage/12 text-sage-dark"><LockKeyhole size={17} aria-hidden="true" /></span>
                    <div>
                      <h3 className="font-serif text-lg">{section.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{section.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="px-5 pt-5">
            <div className="rounded-4xl bg-sage-dark p-5 text-white shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sage-light">Start with the value moment</p>
              <h2 className="mt-2 font-serif text-2xl">Try the direction found today.</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/72">Complete one gentle session, tell Forma how your body feels afterward, and see how the next recommendation adapts.</p>
              <Link href={quickPlanId ? `/session/${quickPlanId}` : '/sessions'} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-sage-dark">
                Try my first five-minute session <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/home" className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-white/72">Continue with free</Link>
            </div>
          </section>
        </>
      )}

      {report.status === 'safety_hold' && (
        <section className="px-5 pt-5">
          <Link href="/home" className="btn-primary w-full">Return to today’s body check-in</Link>
        </section>
      )}
    </div>
  )
}

function FreeSection({ section }: { section: AssessmentReportSection }) {
  const Icon = {
    body_story: HeartHandshake,
    insight: Lightbulb,
    safety: ShieldCheck,
    training_direction: Route,
    reassessment: RefreshCw,
    training_path: Route,
  }[section.kind]
  return (
    <article className={`rounded-3xl border p-5 shadow-card ${section.kind === 'insight' ? 'border-sage/25 bg-sage/10' : 'border-border bg-white'}`}>
      <Icon size={20} className="text-sage-dark" aria-hidden="true" />
      <h2 className="mt-3 font-serif text-xl">{section.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-mid">{section.body}</p>
      {section.confidence !== null && <p className="mt-3 text-[11px] font-medium text-muted">Reliable camera-supported observation</p>}
    </article>
  )
}

function EmptyReport({ error }: { error: string | null }) {
  return (
    <section className="flex min-h-[75dvh] items-center px-5 text-charcoal">
      <div className="w-full rounded-4xl border border-border bg-white p-6 text-center shadow-card">
        {error ? <AlertTriangle size={28} className="mx-auto text-rose-dark" aria-hidden="true" /> : <ShieldCheck size={28} className="mx-auto text-sage-dark" aria-hidden="true" />}
        <h1 className="mt-5 font-serif text-3xl">{error ? 'Your report could not load.' : 'Your body report starts with an assessment.'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">{error ?? 'Complete the camera-supported body assessment to create your personal starting point.'}</p>
        <Link href="/assessment" className="btn-primary mt-7 w-full">{error ? 'Try again' : 'Start body assessment'}</Link>
      </div>
    </section>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}
