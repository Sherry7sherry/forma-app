export function apiError(code: string, status: number, retryable = false) {
  return { ok: false as const, error: { code, ...(retryable ? { retryable: true } : {}) }, status }
}
export function parseJsonRequest(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('malformed_request')
  return value as Record<string, unknown>
}
export function classifyDatabaseError(error: { code?: string }) {
  if (error.code === '23505') return { code: 'duplicate_batch', status: 409, retryable: false }
  if (error.code === 'PGRST116') return { code: 'not_found', status: 404, retryable: false }
  return { code: 'server_error', status: 500, retryable: true }
}
export function jsonError(error: unknown) {
  if (error instanceof TypeError) return Response.json(apiError(error.message, 400).error, { status: 400 })
  const classified = classifyDatabaseError(error as { code?: string })
  return Response.json(apiError(classified.code, classified.status, classified.retryable).error, { status: classified.status })
}
