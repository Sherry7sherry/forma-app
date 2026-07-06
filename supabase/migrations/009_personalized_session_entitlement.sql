-- Forma — one personalized intro session before trial handoff

alter table public.session_records
  add column if not exists report_id uuid;
alter table public.session_records
  add column if not exists is_personalized_intro boolean not null default false;
alter table public.session_records
  add column if not exists post_session_response text
  check (post_session_response in ('better', 'unchanged', 'worse'));
alter table public.user_profiles
  add column if not exists trial_started_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_records_report_owner_fkey'
  ) then
    alter table public.session_records
      add constraint session_records_report_owner_fkey
      foreign key (report_id, user_id)
      references public.body_report_versions (id, user_id)
      on delete set null (report_id);
  end if;
end $$;

create index if not exists session_records_personalized_intro_completed_idx
  on public.session_records (user_id, completed_at desc)
  where is_personalized_intro = true
    and is_partial = false
    and completed_at is not null;

notify pgrst, 'reload schema';
