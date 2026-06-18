import Stripe from 'stripe'
import { appEnv } from '@/lib/env'

export const stripe = new Stripe(appEnv.stripeSecretKey(), {
  apiVersion: '2024-06-20',
  typescript: true,
})

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['3 sessions per week', 'Basic progress tracking', 'Video-guided sessions'],
    sessionLimitWeekly: 3,
    aiCamera: false,
  },
  pro_monthly: {
    name: 'Pro Monthly',
    price: 1499, // cents
    priceId: appEnv.stripeMonthlyPriceId(),
    features: ['Unlimited sessions', 'Real-time AI form analysis', 'Full progress tracking', 'All session types'],
    sessionLimitWeekly: null,
    aiCamera: true,
  },
  pro_yearly: {
    name: 'Pro Yearly',
    price: 9900,
    priceId: appEnv.stripeYearlyPriceId(),
    features: ['Everything in Pro', 'Save 45% vs monthly', 'Priority support'],
    sessionLimitWeekly: null,
    aiCamera: true,
  },
} as const
