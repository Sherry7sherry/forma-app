import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { appEnv } from '@/lib/env'
import { markStripeEventProcessing } from '@/lib/stripeWebhook'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const stripe = getStripe()
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, appEnv.stripeWebhookSecret())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const processing = await markStripeEventProcessing(supabase, event.id, event.type)
  if (!processing.shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Map a Stripe subscription status to our access tier.
  //   active / trialing            → pro (paying or in trial — keep access)
  //   past_due / unpaid            → pro for now (Stripe is still retrying the
  //                                  card; demoting instantly punishes a paying
  //                                  customer for a transient card hiccup —
  //                                  access is removed on `deleted` if it never
  //                                  recovers)
  //   canceled / incomplete_expired→ free
  //   incomplete                   → leave as-is (initial payment not done yet)
  function tierFromStatus(status: Stripe.Subscription.Status): 'pro' | 'free' | null {
    switch (status) {
      case 'active':
      case 'trialing':
      case 'past_due':
      case 'unpaid':
        return 'pro'
      case 'canceled':
      case 'incomplete_expired':
        return 'free'
      default:
        return null // 'incomplete', 'paused' — don't change tier
    }
  }

  switch (event.type) {

    // Fired immediately when checkout completes — most reliable for first upgrade
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.supabase_user_id
      if (!userId) break

      // Retrieve the subscription to get the end date
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const { error } = await supabase.from('user_profiles').update({
          subscription_status:   'pro',
          subscription_end_date: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_profiles').update({
          subscription_status: 'pro',
        }).eq('id', userId)
        if (error) throw error
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break

      const tier = tierFromStatus(sub.status)
      if (tier === null) break // transient state — don't touch the user's access

      const endDate = new Date(sub.current_period_end * 1000).toISOString()

      const { error } = await supabase.from('user_profiles').update({
        subscription_status:   tier,
        subscription_end_date: endDate,
      }).eq('id', userId)
      if (error) throw error
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break

      const { error } = await supabase.from('user_profiles').update({
        subscription_status:   'free',
        subscription_end_date: null,
      }).eq('id', userId)
      if (error) throw error
      break
    }
  }

  return NextResponse.json({ received: true })
}
