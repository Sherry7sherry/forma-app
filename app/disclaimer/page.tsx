import { createClient } from '@/lib/supabase/server'
import DisclaimerGateForm from './DisclaimerGateForm'

export default async function DisclaimerPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; review?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: onboarding }] = await Promise.all([
    supabase.from('user_profiles').select('onboarding_completed').eq('id', user!.id).single(),
    supabase.from('user_onboarding').select('goals, focus_areas').eq('user_id', user!.id).maybeSingle(),
  ])

  const showRecoveryReminder = !!(
    onboarding?.goals?.includes('recovery') || onboarding?.focus_areas?.includes('lower_back')
  )

  const reviewMode = resolvedSearchParams?.review === '1'
  const next = resolvedSearchParams?.next || (profile?.onboarding_completed ? '/home' : '/onboarding')

  return (
    <DisclaimerGateForm
      showRecoveryReminder={showRecoveryReminder}
      next={next}
      reviewMode={reviewMode}
    />
  )
}
