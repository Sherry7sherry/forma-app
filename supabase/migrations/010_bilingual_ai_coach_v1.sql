alter table public.user_profiles
  add column if not exists preferred_locale text not null default 'en-US'
  check (preferred_locale in ('en-US', 'zh-CN'));

alter table public.session_records
  add column if not exists coach_summary_version text,
  add column if not exists coach_summary_status text
    check (coach_summary_status in ('generated', 'fallback', 'unavailable'));
