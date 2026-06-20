type SupabaseQuery = {
  from(table: string): any
}

export type StripeEventProcessingResult =
  | { shouldProcess: true }
  | { shouldProcess: false }

export async function markStripeEventProcessing(
  supabase: SupabaseQuery,
  eventId: string,
  eventType: string
): Promise<StripeEventProcessingResult> {
  const { data: existing, error: lookupError } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing) return { shouldProcess: false }

  const { error: insertError } = await supabase
    .from('stripe_events')
    .insert({ id: eventId, type: eventType })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { shouldProcess: false }
    throw insertError
  }

  return { shouldProcess: true }
}
