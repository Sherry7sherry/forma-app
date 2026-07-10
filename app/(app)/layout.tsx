import BottomNav from '@/components/nav/BottomNav'
import { LocaleProvider } from '@/components/i18n/LocaleProvider'
import { resolveLocale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let accountLocale: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferred_locale')
      .eq('id', user.id)
      .maybeSingle()
    accountLocale = profile?.preferred_locale ?? null
  }

  const locale = resolveLocale({ accountLocale })

  return (
    <div className="min-h-dvh bg-cream max-w-lg mx-auto relative">
      <LocaleProvider initialLocale={locale}>
        <main className="pb-24">
          {children}
        </main>
        <BottomNav />
      </LocaleProvider>
    </div>
  )
}
