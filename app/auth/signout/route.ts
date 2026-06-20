import { createClient } from '@/lib/supabase/server'
import { appEnv } from '@/lib/env'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 303 ensures the browser switches from POST to GET on the redirect, preventing 405
  return NextResponse.redirect(new URL('/', appEnv.appUrl()), { status: 303 })
}
