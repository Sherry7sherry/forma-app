import { NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const confirmation = formData.get('confirmation')
  if (confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Typed confirmation is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 303 })

  const { data: profile } = await supabase.from('user_profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()
  if (profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding') {
    return NextResponse.redirect(new URL('/profile/data-controls?error=billing_active', request.url), { status: 303 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.redirect(new URL('/profile/data-controls?error=delete_failed', request.url), { status: 303 })
  }
  return NextResponse.redirect(new URL('/?account_deleted=1', request.url), { status: 303 })
}
