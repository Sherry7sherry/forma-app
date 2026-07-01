import { redirect } from 'next/navigation'

import BodyAssessmentFlow from './BodyAssessmentFlow'
import { selectAssessmentKind } from '@/lib/bodyAssessment'
import { loadBodyMirrorForUser } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/server'

export default async function AssessmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const bodyMirrorLoad = await loadBodyMirrorForUser(supabase, user.id)
  const result = bodyMirrorLoad.result
  const kind = selectAssessmentKind({
    mobility: result?.dimensions.mobility.state ?? 'no_data',
    control: result?.dimensions.control.state ?? 'no_data',
  })

  return <BodyAssessmentFlow userId={user.id} kind={kind} />
}
