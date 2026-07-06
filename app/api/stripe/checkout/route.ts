import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLANS } from '@/lib/stripe'
import { appEnv } from '@/lib/env'

// POST only — this route has side effects (creates a Stripe customer + checkout
// session). A GET can be triggered by browser/crawler link prefetch and spawn
// stray customers/sessions; a POST submitted from a <form> is never prefetched.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const plan = searchParams.get('plan') as 'monthly' | 'yearly' | null
  const trialRequested = searchParams.get('trial') === 'true'

  if (!plan || !['monthly', 'yearly'].includes(plan)) {
    return NextResponse.redirect(new URL('/profile', request.url), { status: 303 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 303 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, stripe_customer_id, trial_started_at')
    .eq('id', user.id)
    .single()

  // Always use the canonical app URL — never a preview URL
  const appUrl = appEnv.appUrl()

  // Get or create Stripe customer
  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    const { error: customerUpdateError } = await supabase.from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
    if (customerUpdateError) {
      return NextResponse.json({ error: 'Unable to prepare billing profile.' }, { status: 500 })
    }
  }

  const priceId = plan === 'monthly'
    ? PLANS.pro_monthly.priceId
    : PLANS.pro_yearly.priceId

  const trialEligible = trialRequested && !profile?.trial_started_at
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/profile?upgraded=1`,
    cancel_url:  `${appUrl}/profile`,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
      ...(trialEligible ? { trial_period_days: 7 } : {}),
    },
  }, trialEligible ? { idempotencyKey: `forma-trial-${user.id}` } : undefined)

  if (trialEligible) {
    const { error: trialUpdateError } = await supabase.from('user_profiles')
      .update({ trial_started_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('trial_started_at', null)
    if (trialUpdateError) {
      return NextResponse.json({ error: 'Unable to record trial eligibility.' }, { status: 500 })
    }
  }

  return NextResponse.redirect(session.url!, { status: 303 })
}
