import { createClient } from '@/lib/supabase/server'
import SessionsClient from './SessionsClient'

export default async function SessionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: plans }, { data: profile }] = await Promise.all([
    supabase.from('session_plans')
      .select(`
        id, name, description, category, difficulty,
        duration_minutes, goals, focus_areas,
        is_pro, thumbnail_emoji, thumbnail_color
      `)
      .order('is_pro')
      .order('created_at'),
    supabase.from('user_profiles')
      .select('subscription_status')
      .eq('id', user!.id)
      .single(),
  ])

  return (
    <SessionsClient
      plans={plans ?? []}
      isPro={profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'}
    />
  )
}
