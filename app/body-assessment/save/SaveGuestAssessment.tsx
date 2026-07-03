'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, RefreshCw } from 'lucide-react'

import {
  clearGuestAssessment,
  readGuestAssessment,
} from '@/lib/assessmentIntake'
import {
  buildHealthIntakeVersionInsert,
  buildReportVersionInsert,
  saveGuestAssessment,
  type GuestAssessmentPersistence,
} from '@/lib/assessmentReport'
import {
  buildAssessmentCompletion,
  buildAssessmentInsert,
  buildObservationInserts,
} from '@/lib/bodyAssessment'
import { createClient } from '@/lib/supabase/client'
import { assertSupabaseSuccess } from '@/lib/supabaseErrors'

const TRANSFER_KEY = 'forma:guest-assessment-transfer:v1'
type BrowserClient = ReturnType<typeof createClient>

function persistenceAdapter(client: BrowserClient): GuestAssessmentPersistence {
  return {
    async findTransfer(transferId, userId) {
      const result = await client.from('body_report_versions')
        .select('id, assessment_id')
        .eq('user_id', userId)
        .eq('assessment_id', transferId)
        .maybeSingle()
      assertSupabaseSuccess(result, 'Check assessment transfer')
      return result.data?.assessment_id
        ? { assessmentId: result.data.assessment_id, reportId: result.data.id }
        : null
    },

    async ensureAssessment({ transferId, userId, payload }) {
      if (payload.capture?.status !== 'completed') throw new Error('Completed camera evidence is required.')
      const row = {
        id: transferId,
        ...buildAssessmentInsert({
          userId,
          kind: 'baseline',
          captureMode: 'camera',
          startedAt: payload.createdAt,
        }),
        ...buildAssessmentCompletion({
          outcome: 'completed',
          overallConfidence: payload.capture.overallConfidence,
          completedAt: payload.capture.completedAt,
        }),
      }
      const result = await client.from('movement_assessments')
        .upsert(row, { onConflict: 'id' })
        .select('id')
        .single()
      assertSupabaseSuccess(result, 'Save guest assessment')
      return result.data!.id
    },

    async ensureObservations({ assessmentId, userId, observations, observedAt }) {
      const rows = buildObservationInserts({ assessmentId, userId, observations, observedAt })
      const result = await client.from('movement_observations')
        .upsert(rows, { onConflict: 'assessment_id,movement_key,dimension,side,metric_key' })
        .select('id')
      assertSupabaseSuccess(result, 'Save guest movement observations')
      return (result.data ?? []).map(item => item.id)
    },

    async ensureIntakeVersion({ assessmentId, userId, payload, route }) {
      const row = buildHealthIntakeVersionInsert({
        authenticatedUserId: userId,
        userId,
        assessmentId,
        intake: payload.intake,
        route,
        consentVersion: payload.consentVersion,
        planPreferences: {
          availableMinutes: payload.intake.availableMinutes,
          goals: payload.intake.goals,
        },
      })
      const insertResult = await client.from('health_intake_versions')
        .upsert(row, {
          onConflict: 'assessment_id,user_id,intake_version',
          ignoreDuplicates: true,
        })
      assertSupabaseSuccess(insertResult, 'Save assessment intake')
      const saved = await client.from('health_intake_versions')
        .select('id')
        .eq('assessment_id', assessmentId)
        .eq('user_id', userId)
        .eq('intake_version', payload.intake.version)
        .single()
      assertSupabaseSuccess(saved, 'Read saved assessment intake')
      return saved.data!.id
    },

    async ensureReport({ assessmentId, intakeVersionId, userId, report, evidenceRefs }) {
      const row = buildReportVersionInsert({
        authenticatedUserId: userId,
        userId,
        assessmentId,
        intakeVersionId,
        reportVersion: 1,
        engineVersion: report.engineVersion,
        report,
        evidenceRefs,
        changeSummary: 'Initial body starting point',
        generatedAt: report.generatedAt,
      })
      const insertResult = await client.from('body_report_versions')
        .upsert(row, {
          onConflict: 'assessment_id,user_id,report_version',
          ignoreDuplicates: true,
        })
      assertSupabaseSuccess(insertResult, 'Save body report')
      const saved = await client.from('body_report_versions')
        .select('id')
        .eq('assessment_id', assessmentId)
        .eq('user_id', userId)
        .eq('report_version', 1)
        .single()
      assertSupabaseSuccess(saved, 'Read saved body report')
      return saved.data!.id
    },

    async completeTransfer() {
      // The owned report row is the durable completion marker for this transfer.
    },
  }
}

export default function SaveGuestAssessment({ userId }: { userId: string }) {
  const router = useRouter()
  const [client] = useState(createClient)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function run() {
      setError(null)
      try {
        const payload = readGuestAssessment(window.sessionStorage)
        if (!payload) throw new Error('This assessment session is missing or has expired.')
        let transferId = window.sessionStorage.getItem(TRANSFER_KEY)
        if (!transferId) {
          transferId = crypto.randomUUID()
          window.sessionStorage.setItem(TRANSFER_KEY, transferId)
        }
        await saveGuestAssessment(
          { userId, transferId, payload },
          persistenceAdapter(client),
        )
        if (!active) return
        clearGuestAssessment(window.sessionStorage)
        window.sessionStorage.removeItem(TRANSFER_KEY)
        router.replace('/body-report')
        router.refresh()
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to save this assessment.')
      }
    }
    void run()
    return () => { active = false }
  }, [attempt, client, router, userId])

  return (
    <main className="flex min-h-dvh items-center bg-cream px-5 text-charcoal">
      <section className="mx-auto w-full max-w-md rounded-4xl border border-border bg-white p-6 text-center shadow-card">
        {error ? (
          <>
            <RefreshCw size={30} className="mx-auto text-rose-dark" aria-hidden="true" />
            <h1 className="mt-5 font-serif text-3xl">Your assessment is still safe here.</h1>
            <p role="alert" className="mt-3 text-sm leading-relaxed text-charcoal-mid">{error}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Nothing has been cleared from this browser session. You can retry the save.</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)} className="btn-primary mt-7 w-full">Retry save</button>
          </>
        ) : (
          <>
            <LoaderCircle size={32} className="mx-auto animate-spin text-sage-dark" aria-hidden="true" />
            <h1 className="mt-5 font-serif text-3xl">Building your body report…</h1>
            <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">Saving your answers and derived movement observations to your account.</p>
          </>
        )}
      </section>
    </main>
  )
}
