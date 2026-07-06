import { redirect } from 'next/navigation'

import AssessmentReportView from '@/components/body-report/AssessmentReportView'
import { loadLatestReport } from '@/lib/assessmentReport'
import { createClient } from '@/lib/supabase/server'

export default async function BodyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')

  const [loaded, quickPlanResult, historyResult] = await Promise.all([
    loadLatestReport(client, user.id),
    client.from('session_plans').select('id').eq('name', 'Desk Reset').maybeSingle(),
    client.from('body_report_versions')
      .select('id, report_version, generated_at, change_summary')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(12),
  ])

  return (
    <AssessmentReportView
      reportId={loaded.reportId}
      report={loaded.report}
      error={loaded.error}
      quickPlanId={quickPlanResult.data?.id ?? null}
      isMonthlyReview={view === 'monthly'}
      reportHistory={(historyResult.data ?? []).map(item => ({
        id: item.id,
        version: item.report_version,
        generatedAt: item.generated_at,
        changeSummary: item.change_summary,
      }))}
    />
  )
}
