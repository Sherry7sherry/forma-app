type EnvSource = Record<string, string | undefined>

export function readRequiredEnv(env: EnvSource, name: string): string {
  const value = env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function parseInternalTesterEmails(value: string | undefined): readonly string[] {
  return Array.from(new Set((value ?? '').split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)))
}

export const appEnv = {
  supabaseUrl: () => readRequiredEnv(process.env, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => readRequiredEnv(process.env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: () => readRequiredEnv(process.env, 'SUPABASE_SERVICE_ROLE_KEY'),
  stripeSecretKey: () => readRequiredEnv(process.env, 'STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => readRequiredEnv(process.env, 'STRIPE_WEBHOOK_SECRET'),
  stripeMonthlyPriceId: () => readRequiredEnv(process.env, 'STRIPE_PRO_MONTHLY_PRICE_ID'),
  stripeYearlyPriceId: () => readRequiredEnv(process.env, 'STRIPE_PRO_YEARLY_PRICE_ID'),
  appUrl: () => readRequiredEnv(process.env, 'NEXT_PUBLIC_APP_URL').replace(/\/$/, ''),
  internalTesterEmails: () => parseInternalTesterEmails(process.env.INTERNAL_TESTER_EMAILS),
}
