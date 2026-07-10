import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

function clearGate(response: NextResponse) {
  response.cookies.delete('forma_gate')
  return response
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      return clearGate(NextResponse.json(
        { error: 'Unable to sign out. Please try again.' },
        { status: 503 },
      ))
    }
  } catch {
    return clearGate(NextResponse.json(
      { error: 'Unable to sign out. Please try again.' },
      { status: 503 },
    ))
  }

  // 303 changes the browser's follow-up request from POST to GET. Deriving the
  // destination from the request keeps sign-out independent of deployment URL env.
  return clearGate(NextResponse.redirect(
    new URL('/', request.nextUrl.origin),
    { status: 303 },
  ))
}
