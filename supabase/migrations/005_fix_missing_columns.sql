-- ═══════════════════════════════════════════════════════════════
--  Forma — Fix missing user_profiles columns
--
--  Run this in Supabase → SQL Editor → New query → Run.
--
--  Symptom this fixes:
--    "Could not find the 'health_disclaimer_accepted_at' column of
--     'user_profiles' in the schema cache"
--
--  Cause: migrations 003 and 004 were never run, so these columns don't
--  exist yet. This script re-applies both, idempotently (safe to run more
--  than once — `IF NOT EXISTS` means it won't error if a column is already
--  there), then forces PostgREST to reload its schema cache so the app can
--  see the new columns immediately.
-- ═══════════════════════════════════════════════════════════════

-- From 003_health_disclaimer.sql
alter table public.user_profiles
  add column if not exists health_disclaimer_accepted_at timestamptz;

-- From 004_voice_coaching.sql
alter table public.user_profiles
  add column if not exists voice_coaching_enabled boolean not null default true;

-- Tell PostgREST (the API layer Supabase uses) to refresh its schema cache
-- right away, so you don't have to wait or restart anything.
notify pgrst, 'reload schema';
