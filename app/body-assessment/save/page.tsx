import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import SaveGuestAssessment from './SaveGuestAssessment'

export default async function SaveGuestAssessmentPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/signup?next=%2Fbody-assessment%2Fsave')

  return <SaveGuestAssessment userId={user.id} />
}
