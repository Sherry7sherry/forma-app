import { redirect } from 'next/navigation'

import AssessmentReportView from '@/components/body-report/AssessmentReportView'
import { loadLatestReport } from '@/lib/assessmentReport'
import { createClient } from '@/lib/supabase/server'

export default async function BodyReportPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')

  const [loaded, quickPlanResult] = await Promise.all([
    loadLatestReport(client, user.id),
    client.from('session_plans').select('id').eq('name', 'Desk Reset').maybeSingle(),
  ])

  return (
    <AssessmentReportView
      reportId={loaded.reportId}
      report={loaded.report}
      error={loaded.error}
      quickPlanId={quickPlanResult.data?.id ?? null}
    />
  )
}
