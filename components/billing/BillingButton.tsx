// Billing actions must be triggered by a real POST (side effects: creating a
// Stripe customer, checkout session, or portal session). Using a <form> instead
// of an <a href> means the action is never fired by browser/crawler prefetch.
//
// These render a plain HTML <form>, so they work inside BOTH server and client
// components without needing 'use client'. The wrapping <form> uses `contents`
// so it doesn't introduce its own box and the button inherits the parent layout.

interface UpgradeButtonProps {
  plan: 'monthly' | 'yearly'
  className?: string
  children: React.ReactNode
}

export function UpgradeButton({ plan, className, children }: UpgradeButtonProps) {
  return (
    <form action={`/api/stripe/checkout?plan=${plan}`} method="POST" className="contents">
      <button type="submit" className={className}>{children}</button>
    </form>
  )
}

interface ManageBillingButtonProps {
  className?: string
  children: React.ReactNode
}

export function ManageBillingButton({ className, children }: ManageBillingButtonProps) {
  return (
    <form action="/api/stripe/portal" method="POST" className="contents">
      <button type="submit" className={className}>{children}</button>
    </form>
  )
}
