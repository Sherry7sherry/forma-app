-- ═══════════════════════════════════════════════════════════════
--  Forma — Initial Database Schema
--  Run this in your Supabase project: SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── User Profiles ────────────────────────────────────────────────
create table public.user_profiles (
  id                    uuid references auth.users(id) on delete cascade primary key,
  email                 text not null,
  full_name             text,
  avatar_url            text,
  subscription_status   text not null default 'free' check (subscription_status in ('free','pro','founding')),
  subscription_end_date timestamptz,
  stripe_customer_id    text unique,
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Onboarding Answers ───────────────────────────────────────────
create table public.user_onboarding (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.user_profiles(id) on delete cascade not null unique,
  goals               text[] not null default '{}',
  experience_level    text not null default 'beginner',
  focus_areas         text[] not null default '{}',
  sessions_per_week   int not null default 3,
  created_at          timestamptz not null default now()
);

-- ── Exercises ────────────────────────────────────────────────────
create table public.exercises (
  id               uuid default uuid_generate_v4() primary key,
  name             text not null,
  description      text not null,
  instructions     text[] not null default '{}',
  target_muscles   text[] not null default '{}',
  category         text not null,
  difficulty       text not null default 'gentle',
  duration_type    text not null default 'reps' check (duration_type in ('reps','hold')),
  default_reps     int not null default 10,
  video_url        text,
  thumbnail_url    text,
  pose_definition  jsonb,
  is_pro           boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ── Session Plans ─────────────────────────────────────────────────
create table public.session_plans (
  id                uuid default uuid_generate_v4() primary key,
  name              text not null,
  description       text not null,
  category          text not null,
  difficulty        text not null default 'gentle',
  duration_minutes  int not null,
  goals             text[] not null default '{}',
  focus_areas       text[] not null default '{}',
  is_pro            boolean not null default false,
  thumbnail_emoji   text not null default '🌿',
  thumbnail_color   text not null default 'from-sage-dark to-sage',
  created_at        timestamptz not null default now()
);

-- ── Session Plan Exercises (join table) ───────────────────────────
create table public.session_plan_exercises (
  id                  uuid default uuid_generate_v4() primary key,
  session_plan_id     uuid references public.session_plans(id) on delete cascade not null,
  exercise_id         uuid references public.exercises(id) on delete cascade not null,
  order_index         int not null,
  reps_override       int,
  rest_after_seconds  int not null default 15,
  unique(session_plan_id, order_index)
);

-- ── Session Records (completed) ───────────────────────────────────
create table public.session_records (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references public.user_profiles(id) on delete cascade not null,
  session_plan_id       uuid references public.session_plans(id) not null,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  duration_seconds      int not null default 0,
  form_score            numeric(5,2) not null default 0,
  reps_completed        int not null default 0,
  exercises_completed   int not null default 0,
  ai_feedback           text,
  body_feel_before      text check (body_feel_before in ('tight','okay','good','great')),
  body_feel_after       text check (body_feel_after in ('tight','okay','good','great')),
  exercise_scores       jsonb not null default '[]',
  created_at            timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────
alter table public.user_profiles     enable row level security;
alter table public.user_onboarding   enable row level security;
alter table public.session_records   enable row level security;
alter table public.exercises         enable row level security;
alter table public.session_plans     enable row level security;
alter table public.session_plan_exercises enable row level security;

-- Users can only read/write their own profile
create policy "Users can view own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- Users can only read/write their own onboarding
create policy "Users can manage own onboarding"
  on public.user_onboarding for all using (auth.uid() = user_id);

-- Users can only read/write their own session records
create policy "Users can manage own session records"
  on public.session_records for all using (auth.uid() = user_id);

-- Exercises & session plans are public read
create policy "Anyone can read exercises"
  on public.exercises for select using (true);
create policy "Anyone can read session plans"
  on public.session_plans for select using (true);
create policy "Anyone can read session plan exercises"
  on public.session_plan_exercises for select using (true);

-- ── Auto-create profile on signup ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Updated_at trigger ────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();
