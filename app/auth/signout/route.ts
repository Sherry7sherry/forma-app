import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  // 303 ensures the browser switches from POST to GET on the redirect, preventing 405
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!), { status: 303 })
}
