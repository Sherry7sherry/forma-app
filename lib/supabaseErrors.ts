type SupabaseResult = {
  error?: { message?: string } | null
}

export function assertSupabaseSuccess(result: SupabaseResult, action: string): void {
  if (!result.error) return
  const message = result.error.message || 'Unknown Supabase error'
  throw new Error(`${action} failed: ${message}`)
}
