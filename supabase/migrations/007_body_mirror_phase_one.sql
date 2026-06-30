-- Forma — Body Mirror phase one evidence model

create unique index if not exists session_records_id_user_key
  on public.session_records (id, user_id);

create table if not exists public.body_check_ins (
  id                 uuid default uuid_generate_v4() primary key,
  user_id            uuid references public.user_profiles(id) on delete cascade not null,
  context            text not null check (context in ('baseline','daily','pre_session','post_session')),
  comfort            smallint not null check (comfort between 1 and 5),
  focus_areas        text[] not null default '{}',
  safety_signals     text[] not null default '{}'
    check (safety_signals <@ ARRAY[
      'sharp_pain',
      'numbness',
      'radiating_pain',
      'dizziness',
      'chest_pain',
      'shortness_of_breath',
      'sudden_weakness'
    ]::text[]),
  notes              text,
  session_record_id  uuid,
  recorded_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_record_id, user_id)
    references public.session_records (id, user_id) on delete set null (session_record_id)
);

create table if not exists public.movement_assessments (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.user_profiles(id) on delete cascade not null,
  kind                text not null check (kind in ('baseline','reassessment','daily')),
  capture_mode        text not null check (capture_mode in ('camera','self_report')),
  status              text not null default 'in_progress'
    check (status in ('in_progress','completed','partial','camera_unavailable','low_confidence')),
  overall_confidence  numeric(4,3) check (overall_confidence between 0 and 1),
  body_check_in_id    uuid,
  session_record_id   uuid,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (id, user_id),
  foreign key (body_check_in_id, user_id)
    references public.body_check_ins (id, user_id) on delete set null (body_check_in_id),
  foreign key (session_record_id, user_id)
    references public.session_records (id, user_id) on delete set null (session_record_id)
);

create table if not exists public.movement_observations (
  id                uuid default uuid_generate_v4() primary key,
  assessment_id     uuid not null,
  user_id           uuid references public.user_profiles(id) on delete cascade not null,
  movement_key      text not null
    check (movement_key in ('side_arm_raise','standing_roll_down','seated_trunk_rotation')),
  dimension         text not null check (dimension in ('mobility','control')),
  side              text not null default 'center'
    check (side in ('left','right','center','bilateral')),
  metric_key        text not null,
  value             numeric not null,
  unit              text not null,
  better_direction  text not null default 'higher'
    check (better_direction in ('higher','lower')),
  change_threshold  numeric not null default 0 check (change_threshold >= 0),
  confidence        numeric(4,3) not null check (confidence between 0 and 1),
  observed_at       timestamptz not null default now(),
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id) on delete cascade,
  unique (assessment_id, movement_key, dimension, side, metric_key)
);

create index if not exists body_check_ins_user_recorded_idx
  on public.body_check_ins (user_id, recorded_at desc);
create index if not exists movement_assessments_user_completed_idx
  on public.movement_assessments (user_id, completed_at desc);
create index if not exists movement_observations_user_observed_idx
  on public.movement_observations (user_id, observed_at desc);

alter table public.body_check_ins enable row level security;
alter table public.movement_assessments enable row level security;
alter table public.movement_observations enable row level security;

drop policy if exists "Users can manage own body check-ins" on public.body_check_ins;
create policy "Users can manage own body check-ins"
  on public.body_check_ins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own movement assessments" on public.movement_assessments;
create policy "Users can manage own movement assessments"
  on public.movement_assessments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own movement observations" on public.movement_observations;
create policy "Users can manage own movement observations"
  on public.movement_observations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.session_plans
  (name, description, category, difficulty, duration_minutes, goals, focus_areas, is_pro, thumbnail_emoji, thumbnail_color)
values
  (
    'Desk Reset',
    'A four-minute, no-mat reset for shoulders, spine, and controlled rotation after sitting.',
    'spine',
    'gentle',
    4,
    ARRAY['recovery','flexibility'],
    ARRAY['neck_shoulders','lower_back'],
    false,
    '🌿',
    'from-sage-dark to-sage'
  )
on conflict (name) do update
set description = excluded.description,
    category = excluded.category,
    difficulty = excluded.difficulty,
    duration_minutes = excluded.duration_minutes,
    goals = excluded.goals,
    focus_areas = excluded.focus_areas,
    is_pro = excluded.is_pro,
    thumbnail_emoji = excluded.thumbnail_emoji,
    thumbnail_color = excluded.thumbnail_color;

delete from public.session_plan_exercises spe
using public.session_plans sp
where spe.session_plan_id = sp.id
  and sp.name = 'Desk Reset';

with quick_exercises(exercise_name, order_index, reps_override, rest_after_seconds) as (
  values
    ('Arm Arcs', 0, 6, 5),
    ('Standing Roll Down', 1, 3, 5),
    ('Spine Twist', 2, 6, 5)
)
insert into public.session_plan_exercises
  (session_plan_id, exercise_id, order_index, reps_override, rest_after_seconds)
select sp.id, ex.id, qe.order_index, qe.reps_override, qe.rest_after_seconds
from quick_exercises qe
join public.session_plans sp on sp.name = 'Desk Reset'
join public.exercises ex on ex.name = qe.exercise_name
on conflict (session_plan_id, order_index) do update
set exercise_id = excluded.exercise_id,
    reps_override = excluded.reps_override,
    rest_after_seconds = excluded.rest_after_seconds;

notify pgrst, 'reload schema';
