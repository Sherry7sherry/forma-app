import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const EXPORT_TABLES = [
  'user_profiles',
  'user_onboarding',
  'body_check_ins',
  'movement_assessments',
  'movement_observations',
  'assessment_intake_versions',
  'body_report_versions',
  'session_records',
] as const

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const results = await Promise.all(EXPORT_TABLES.map(async table => {
    const ownerColumn = table === 'user_profiles' ? 'id' : 'user_id'
    const result = await supabase.from(table).select('*').eq(ownerColumn, user.id)
    return [table, result] as const
  }))
  const failed = results.find(([, result]) => result.error)
  if (failed) return NextResponse.json({ error: 'Unable to prepare data export.' }, { status: 500 })

  const data = Object.fromEntries(results.map(([table, result]) => [table, result.data ?? []]))
  return NextResponse.json({ exportedAt: new Date().toISOString(), data }, {
    headers: {
      'Content-Disposition': `attachment; filename="forma-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
