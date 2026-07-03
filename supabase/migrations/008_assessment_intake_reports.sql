-- Forma — versioned assessment intake and derived body reports

create table if not exists public.health_intake_versions (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references public.user_profiles(id) on delete cascade not null,
  assessment_id     uuid,
  intake_version    integer not null check (intake_version > 0),
  answers           jsonb not null,
  safety_state      text not null check (safety_state in ('standard','modified','stop')),
  constraints       jsonb not null default '[]',
  plan_preferences  jsonb not null default '{}',
  consent_version   text not null check (length(trim(consent_version)) > 0),
  created_at        timestamptz not null default now(),
  unique (id, user_id),
  unique (assessment_id, user_id, intake_version),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id)
    on delete set null (assessment_id)
);

create table if not exists public.body_report_versions (
  id                 uuid default uuid_generate_v4() primary key,
  user_id            uuid references public.user_profiles(id) on delete cascade not null,
  assessment_id      uuid,
  intake_version_id  uuid,
  report_version     integer not null check (report_version > 0),
  engine_version     text not null,
  report             jsonb not null,
  evidence_refs      jsonb not null default '[]',
  change_summary     text,
  generated_at       timestamptz not null default now(),
  unique (assessment_id, user_id, report_version),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id)
    on delete set null (assessment_id),
  foreign key (intake_version_id, user_id)
    references public.health_intake_versions (id, user_id)
    on delete set null (intake_version_id)
);

create index if not exists health_intake_versions_user_created_idx
  on public.health_intake_versions (user_id, created_at desc);
create index if not exists body_report_versions_user_generated_idx
  on public.body_report_versions (user_id, generated_at desc);

alter table public.health_intake_versions enable row level security;
alter table public.body_report_versions enable row level security;

drop policy if exists "Users can manage own health intake versions"
  on public.health_intake_versions;
create policy "Users can manage own health intake versions"
  on public.health_intake_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own body report versions"
  on public.body_report_versions;
create policy "Users can manage own body report versions"
  on public.body_report_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.body_check_ins
  drop constraint if exists body_check_ins_safety_signals_check;
alter table public.body_check_ins
  add constraint body_check_ins_safety_signals_check
  check (safety_signals <@ ARRAY[
    'sharp_pain',
    'numbness',
    'radiating_pain',
    'dizziness',
    'chest_pain',
    'shortness_of_breath',
    'sudden_weakness',
    'professional_pause'
  ]::text[]);

notify pgrst, 'reload schema';
