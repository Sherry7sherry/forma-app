import { createBrowserClient } from '@supabase/ssr'
import { appEnv } from '@/lib/env'

export function createClient() {
  return createBrowserClient(
    appEnv.supabaseUrl(),
    appEnv.supabaseAnonKey()
  )
}
