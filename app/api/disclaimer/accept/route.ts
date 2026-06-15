import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    // 1. Verify the session with the cookie-based client
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized — please sign in again.' }, { status: 401 })
    }

    // 2. Write with a TRUE admin client (service role, no user session) so RLS
    //    is genuinely bypassed. The service key never reaches the browser.
    const admin = createAdminClient()
    const { error } = await admin
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? '',
          health_disclaimer_accepted_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (error) {
      // Surface a clear, actionable message. A missing column here almost always
      // means migration 003_health_disclaimer.sql hasn't been run on this DB.
      console.error('[disclaimer/accept]', error)
      const hint = /column .* does not exist/i.test(error.message)
        ? 'Database is missing the health_disclaimer_accepted_at column — run migration 003.'
        : error.message
      return NextResponse.json({ error: hint }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[disclaimer/accept] unhandled', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unexpected server error.' },
      { status: 500 }
    )
  }
}
