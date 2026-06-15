-- ═══════════════════════════════════════════════════════════════
--  Forma — Health & Safety Disclaimer Acceptance
--  Run this in your Supabase project: SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Tracks when the user accepted the health & safety notice.
-- NULL = not yet accepted (gate must be shown before onboarding/sessions).
alter table public.user_profiles
  add column if not exists health_disclaimer_accepted_at timestamptz;
