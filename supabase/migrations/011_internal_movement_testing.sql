create table if not exists public.internal_test_runs (
  id uuid primary key default gen_random_uuid(), tester_id uuid not null references auth.users(id) on delete cascade,
  source_flow text not null check (source_flow in ('assessment','session','directed')),
  build_version text not null, profile_version text not null, environment jsonb not null default '{}'::jsonb,
  device_class text, browser text, status text not null default 'active',
  started_at timestamptz not null default now(), ended_at timestamptz
);
create table if not exists public.internal_test_attempts (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.internal_test_runs(id) on delete cascade,
  movement_id text not null, movement_kind text not null check (movement_kind in ('assessment','exercise')),
  posture_family text not null, phase text not null, status text not null default 'active', issue_type text,
  synthetic boolean not null default false, summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(), ended_at timestamptz
);
create table if not exists public.internal_test_events (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.internal_test_attempts(id) on delete cascade,
  sequence integer not null check (sequence >= 0), started_elapsed_ms integer not null default 0,
  ended_elapsed_ms integer not null default 0, payload jsonb not null, created_at timestamptz not null default now(),
  unique (attempt_id, sequence)
);
create table if not exists public.internal_test_artifacts (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.internal_test_attempts(id) on delete cascade,
  artifact_kind text not null, storage_path text, export_metadata jsonb, checksum text,
  upload_state text not null default 'pending', retention_until timestamptz, created_at timestamptz not null default now()
);

create index if not exists internal_test_runs_build_idx on public.internal_test_runs(build_version);
create index if not exists internal_test_runs_device_browser_idx on public.internal_test_runs(device_class, browser);
create index if not exists internal_test_runs_started_idx on public.internal_test_runs(started_at desc);
create index if not exists internal_test_attempts_movement_idx on public.internal_test_attempts(movement_id);
create index if not exists internal_test_attempts_status_idx on public.internal_test_attempts(status);
create index if not exists internal_test_attempts_posture_issue_idx on public.internal_test_attempts(posture_family, issue_type);
create index if not exists internal_test_attempts_started_idx on public.internal_test_attempts(started_at desc);

alter table public.internal_test_runs enable row level security;
alter table public.internal_test_attempts enable row level security;
alter table public.internal_test_events enable row level security;
alter table public.internal_test_artifacts enable row level security;

revoke all on public.internal_test_runs from anon, authenticated;
revoke all on public.internal_test_attempts from anon, authenticated;
revoke all on public.internal_test_events from anon, authenticated;
revoke all on public.internal_test_artifacts from anon, authenticated;
