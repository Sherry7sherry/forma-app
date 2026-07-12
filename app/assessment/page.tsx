import { redirect } from 'next/navigation'

import BodyAssessmentFlow from './BodyAssessmentFlow'
import { selectAssessmentKind } from '@/lib/bodyAssessment'
import { loadBodyMirrorForUser } from '@/lib/bodyMirror'
import { createClient } from '@/lib/supabase/server'
import { appEnv } from '@/lib/env'
import { authorizeInternalIdentity } from '@/lib/internalTesting/auth'

export default async function AssessmentPage({searchParams}:{searchParams:Promise<{testMode?:string}>}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const bodyMirrorLoad = await loadBodyMirrorForUser(supabase, user.id)
  const result = bodyMirrorLoad.result
  const kind = selectAssessmentKind({
    mobility: result?.dimensions.mobility.state ?? 'no_data',
    control: result?.dimensions.control.state ?? 'no_data',
  })

  const requested=(await searchParams).testMode==='1'
  const internalTest=requested&&!!authorizeInternalIdentity(user,appEnv.internalTesterEmails())
  return <BodyAssessmentFlow userId={user.id} kind={kind} internalTest={internalTest} />
}
