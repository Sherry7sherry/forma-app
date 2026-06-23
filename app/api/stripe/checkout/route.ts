import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, PLANS } from '@/lib/stripe'
import { appEnv } from '@/lib/env'

// POST only — this route has side effects (creates a Stripe customer + checkout
// session). A GET can be triggered by browser/crawler link prefetch and spawn
// stray customers/sessions; a POST submitted from a <form> is never prefetched.
export async function POST(request: Request) {
  const stripe = getStripe()
  const { searchParams } = new URL(request.url)
  const plan = searchParams.get('plan') as 'monthly' | 'yearly' | null

  if (!plan || !['monthly', 'yearly'].includes(plan)) {
    return NextResponse.redirect(new URL('/profile', request.url), { status: 303 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 303 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, stripe_customer_id')
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
    },
  })

  return NextResponse.redirect(session.url!, { status: 303 })
}
