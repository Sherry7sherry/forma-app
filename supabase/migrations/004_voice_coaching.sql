-- ═══════════════════════════════════════════════════════════════
--  Forma — Voice Coaching Preference
--  Run this in your Supabase project: SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Whether the user wants spoken coaching prompts during AI camera sessions
-- (rep-counting status, framing guidance, transition announcements, etc).
-- Defaults to on; users can turn it off from Profile → Preferences.
alter table public.user_profiles
  add column if not exists voice_coaching_enabled boolean not null default true;
