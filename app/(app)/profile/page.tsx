import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import VoiceCoachingToggle from '@/components/profile/VoiceCoachingToggle'
import { UpgradeButton, ManageBillingButton } from '@/components/billing/BillingButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, subscription_status, created_at, voice_coaching_enabled')
    .eq('id', user!.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'User'
  const initial   = firstName[0]?.toUpperCase() ?? 'U'
  const isPro     = profile?.subscription_status === 'pro' || profile?.subscription_status === 'founding'
  // Guard against null/invalid created_at — `new Date('')` and `new Date(null)` both produce
  // Invalid Date, which serialises to "Invalid Date" in toLocaleDateString.
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="pt-14 pb-6 fade-up">
      {/* Avatar */}
      <div className="px-5 pb-6 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-light to-rose
                          flex items-center justify-center font-serif text-3xl text-white
                          shadow-[0_6px_20px_rgba(212,137,122,.35)] mx-auto">
            {initial}
          </div>
          <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full
                          bg-sage border-2 border-cream flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>
        <h1 className="font-serif text-xl font-medium mb-1">{profile?.full_name ?? firstName}</h1>
        <p className="text-muted text-xs">
          {isPro ? 'Forma Pro' : 'Forma Free'}{joinedDate ? ` · Member since ${joinedDate}` : ''}
        </p>
      </div>

      {/* Upgrade banner (free users) */}
      {!isPro && (
        <div id="upgrade" className="mx-5 mb-5 rounded-2xl p-5
                                     bg-gradient-to-br from-sage to-sage-dark shadow-soft">
          <div className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-1">
            Unlock everything
          </div>
          <h3 className="font-serif text-xl text-white mb-1">Upgrade to Pro</h3>
          <p className="text-white/75 text-xs mb-4">
            AI camera, unlimited sessions, advanced tracking.
          </p>
          <div className="flex gap-2">
            <UpgradeButton plan="monthly"
              className="flex-1 text-center bg-white text-sage-dark rounded-full py-2.5
                         text-sm font-semibold shadow active:scale-95 transition-transform">
              $14.99 / month
            </UpgradeButton>
            <UpgradeButton plan="yearly"
              className="flex-1 text-center bg-white/20 text-white rounded-full py-2.5
                         text-sm font-semibold border border-white/30 active:scale-95 transition-transform">
              $99 / year
            </UpgradeButton>
          </div>
          <p className="text-white/55 text-[11px] text-center mt-3">
            🌟 Founding member offer — limited spots
          </p>
        </div>
      )}

      {/* Settings groups */}
      <SettingGroup title="Your Plan">
        <SettingItem icon="✅" iconBg="bg-sage/15" label="Current focus" value="Recovery + Alignment" />
        <SettingItem icon="🎯" iconBg="bg-rose/15" label="Focus areas" value="Neck, shoulders, core" />
      </SettingGroup>

      <SettingGroup title="Preferences">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-sage/15 flex-shrink-0">
            🔊
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-charcoal">Voice coaching</div>
            <div className="text-xs text-muted">Spoken rep-counting &amp; framing prompts during AI camera sessions</div>
          </div>
          <VoiceCoachingToggle userId={user!.id} initialEnabled={profile?.voice_coaching_enabled ?? true} />
        </div>
        <SettingItem icon="📊" iconBg="bg-amber-100" label="Session difficulty" value="Moderate — coming soon" />
        <SettingItem icon="🔔" iconBg="bg-rose/15" label="Daily reminder" value="8:00 AM — coming soon" />
      </SettingGroup>

      <SettingGroup title="Account">
        {isPro
          ? <SubscriptionItem />
          : <SettingItem icon="💳" iconBg="bg-sage/15" label="Subscription" value="Free plan" />
        }
        <Link href="/disclaimer?review=1"
          className="flex items-center gap-3 px-4 py-3.5 active:bg-cream-dark transition-colors">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-sage/15 flex-shrink-0">
            🩺
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-charcoal">Health &amp; safety notice</div>
            <div className="text-xs text-muted">Review the notice you agreed to</div>
          </div>
          <span className="text-border text-lg">›</span>
        </Link>
        <SignOutItem />
      </SettingGroup>
    </div>
  )
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 mb-5">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 pl-1">{title}</p>
      <div className="bg-white border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function SettingItem({ icon, iconBg, label, value, arrow }:
  { icon: string; iconBg: string; label: string; value: string; arrow?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 active:bg-cream-dark transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-charcoal">{label}</div>
        <div className="text-xs text-muted">{value}</div>
      </div>
      {arrow && <span className="text-border text-lg">›</span>}
    </div>
  )
}

function SubscriptionItem() {
  return (
    <ManageBillingButton
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-cream-dark transition-colors text-left">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-sage/15 flex-shrink-0">
        💳
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-charcoal">Subscription</div>
        <div className="text-xs text-muted">Pro · active — manage billing</div>
      </div>
      <span className="text-border text-lg">›</span>
    </ManageBillingButton>
  )
}

function SignOutItem() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit"
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-cream-dark transition-colors">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-red-50 flex-shrink-0">
          🚪
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-red-500">Sign out</div>
        </div>
      </button>
    </form>
  )
}
