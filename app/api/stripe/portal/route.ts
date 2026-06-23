import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { appEnv } from '@/lib/env'

// POST only — opening a billing-portal session is a side effect that should
// never be triggered by link prefetch. Submitted from a <form method="POST">.
export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 303 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    // No Stripe customer — nothing to manage
    return NextResponse.redirect(new URL('/profile', request.url), { status: 303 })
  }

  const appUrl = appEnv.appUrl()

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl}/profile`,
  })

  return NextResponse.redirect(session.url, { status: 303 })
}
