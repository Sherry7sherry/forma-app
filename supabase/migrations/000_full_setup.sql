-- ═══════════════════════════════════════════════════════════════
--  Forma — FULL SETUP (run-everything-from-scratch)
--
--  Safe to run on a brand-new project OR an existing one: every
--  statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP-then-
--  CREATE / guarded seeds), so re-running it never errors and never
--  duplicates data.
--
--  Paste the whole file into Supabase → SQL Editor → New query → Run.
--
--  This consolidates migrations 001–004 AND adds columns the app code
--  uses that were missing from the original migrations:
--    • user_profiles.health_disclaimer_accepted_at   (was 003)
--    • user_profiles.voice_coaching_enabled          (was 004)
--    • session_records.last_exercise_index           (used by resume)
--    • session_records.total_exercises               (used by resume)
--    • session_records.is_partial                    (used by resume)
--    • session_records.skipped_exercises             (used by results)
--  It also seeds the session_plan_exercises join table, which had no
--  seed anywhere — without it, session plans contain zero exercises.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ───────────────────────────────────────────────────────────────
--  TABLES
-- ───────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id                    uuid references auth.users(id) on delete cascade primary key,
  email                 text not null,
  full_name             text,
  avatar_url            text,
  subscription_status   text not null default 'free' check (subscription_status in ('free','pro','founding')),
  subscription_end_date timestamptz,
  stripe_customer_id    text unique,
  onboarding_completed  boolean not null default false,
  health_disclaimer_accepted_at timestamptz,
  voice_coaching_enabled boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.user_onboarding (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.user_profiles(id) on delete cascade not null unique,
  goals               text[] not null default '{}',
  experience_level    text not null default 'beginner',
  focus_areas         text[] not null default '{}',
  sessions_per_week   int not null default 3,
  created_at          timestamptz not null default now()
);

create table if not exists public.exercises (
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

create table if not exists public.session_plans (
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

create table if not exists public.session_plan_exercises (
  id                  uuid default uuid_generate_v4() primary key,
  session_plan_id     uuid references public.session_plans(id) on delete cascade not null,
  exercise_id         uuid references public.exercises(id) on delete cascade not null,
  order_index         int not null,
  reps_override       int,
  rest_after_seconds  int not null default 15,
  unique(session_plan_id, order_index)
);

create table if not exists public.session_records (
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
  last_exercise_index   int not null default 0,
  total_exercises       int not null default 0,
  is_partial            boolean not null default false,
  skipped_exercises     int not null default 0,
  created_at            timestamptz not null default now()
);

create unique index if not exists session_records_id_user_key
  on public.session_records (id, user_id);

create table if not exists public.body_check_ins (
  id                 uuid default uuid_generate_v4() primary key,
  user_id            uuid references public.user_profiles(id) on delete cascade not null,
  context            text not null check (context in ('baseline','daily','pre_session','post_session')),
  comfort            smallint not null check (comfort between 1 and 5),
  focus_areas        text[] not null default '{}',
  safety_signals     text[] not null default '{}'
    check (safety_signals <@ ARRAY['sharp_pain','numbness','radiating_pain','dizziness','chest_pain','shortness_of_breath','sudden_weakness']::text[]),
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
  better_direction  text not null default 'higher' check (better_direction in ('higher','lower')),
  change_threshold  numeric not null default 0 check (change_threshold >= 0),
  confidence        numeric(4,3) not null check (confidence between 0 and 1),
  observed_at       timestamptz not null default now(),
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  foreign key (assessment_id, user_id)
    references public.movement_assessments (id, user_id) on delete cascade,
  unique (assessment_id, movement_key, dimension, side, metric_key)
);

create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────
--  COLUMN BACKFILL (for databases created from the older migrations)
-- ───────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists health_disclaimer_accepted_at timestamptz;
alter table public.user_profiles
  add column if not exists voice_coaching_enabled boolean not null default true;

alter table public.session_records
  add column if not exists last_exercise_index int not null default 0;
alter table public.session_records
  add column if not exists total_exercises     int not null default 0;
alter table public.session_records
  add column if not exists is_partial          boolean not null default false;
alter table public.session_records
  add column if not exists skipped_exercises   int not null default 0;

-- Unique names so the seeds below can use ON CONFLICT and stay idempotent.
create unique index if not exists exercises_name_key     on public.exercises (name);
create unique index if not exists session_plans_name_key on public.session_plans (name);

-- ───────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────
alter table public.user_profiles          enable row level security;
alter table public.user_onboarding        enable row level security;
alter table public.session_records        enable row level security;
alter table public.body_check_ins         enable row level security;
alter table public.movement_assessments   enable row level security;
alter table public.movement_observations  enable row level security;
alter table public.exercises              enable row level security;
alter table public.session_plans          enable row level security;
alter table public.session_plan_exercises enable row level security;
alter table public.stripe_events          enable row level security;

drop policy if exists "Users can view own profile"   on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

drop policy if exists "Users can manage own onboarding" on public.user_onboarding;
create policy "Users can manage own onboarding"
  on public.user_onboarding for all using (auth.uid() = user_id);

drop policy if exists "Users can manage own session records" on public.session_records;
create policy "Users can manage own session records"
  on public.session_records for all using (auth.uid() = user_id);

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

drop policy if exists "Anyone can read exercises" on public.exercises;
create policy "Anyone can read exercises"
  on public.exercises for select using (true);

drop policy if exists "Anyone can read session plans" on public.session_plans;
create policy "Anyone can read session plans"
  on public.session_plans for select using (true);

drop policy if exists "Anyone can read session plan exercises" on public.session_plan_exercises;
create policy "Anyone can read session plan exercises"
  on public.session_plan_exercises for select using (true);

-- ───────────────────────────────────────────────────────────────
--  TRIGGERS
-- ───────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
--  SEED — Exercises (idempotent via ON CONFLICT (name))
-- ───────────────────────────────────────────────────────────────
insert into public.exercises
  (name, description, instructions, target_muscles, category, difficulty, duration_type, default_reps, pose_definition, is_pro)
values
('Pelvic Tilts',
 'A foundational movement that mobilises the lumbar spine and activates deep core muscles.',
 ARRAY['Lie on your back, knees bent, feet flat','Inhale to prepare','Exhale, gently tilt pelvis toward ribs — lower back presses into mat','Inhale, return to neutral','Move only your pelvis, keep upper body still'],
 ARRAY['transverse abdominis','multifidus','glutes'],
 'spine', 'gentle', 'reps', 12,
 '{"key_angles":[{"joint":"lumbar_spine","min_degrees":0,"max_degrees":15,"landmark_indices":[23,24,11]}],"alignment_cues":[{"condition":"spine_neutral","feedback_good":"Spine aligned ✓","feedback_warn":"Avoid arching your lower back"}],"common_mistakes":["Holding breath","Moving upper back instead of pelvis"]}',
 false),
('Cat-Cow Stretch',
 'Rhythmic spinal flexion and extension that lubricates the vertebrae and releases tension.',
 ARRAY['Start on hands and knees, wrists under shoulders, knees under hips','Inhale — drop belly, lift chest and tailbone (Cow)','Exhale — round spine toward ceiling, tuck chin and pelvis (Cat)','Move vertebra by vertebra, breath leads the movement'],
 ARRAY['erector_spinae','multifidus','rectus_abdominis'],
 'spine', 'gentle', 'reps', 10,
 '{"key_angles":[{"joint":"thoracic_spine","min_degrees":-20,"max_degrees":20,"landmark_indices":[11,12,23]}],"alignment_cues":[{"condition":"cat_position","feedback_good":"Full spinal flexion ✓","feedback_warn":"Round through your whole spine, not just lower back"}],"common_mistakes":["Only moving lower back","Rushing the movement"]}',
 false),
('Spine Twist',
 'Seated rotation that mobilises the thoracic spine and stretches the obliques.',
 ARRAY['Sit tall, legs extended or crossed','Arms in a T or hands behind head','Inhale to grow tall','Exhale, rotate from your waist — keep hips square','Return to centre on inhale','Alternate sides with control'],
 ARRAY['obliques','thoracic_extensors','hip_flexors'],
 'spine', 'moderate', 'reps', 8,
 '{"key_angles":[{"joint":"thoracic_rotation","min_degrees":30,"max_degrees":60,"landmark_indices":[11,12,23]}],"alignment_cues":[{"condition":"rotation","feedback_good":"Good thoracic rotation ✓","feedback_warn":"Keep both sit bones grounded"}],"common_mistakes":["Leaning instead of rotating","Hips lifting off"]}',
 false),
('Swan Prep',
 'Prone extension that strengthens the back extensors and opens the chest.',
 ARRAY['Lie face down, hands under shoulders','Draw shoulder blades back and down','Inhale to prepare','Exhale, press through hands to lift chest off mat','Keep elbows slightly bent, neck long','Inhale at top, exhale to lower with control'],
 ARRAY['erector_spinae','rhomboids','gluteus_maximus'],
 'spine', 'moderate', 'reps', 10,
 '{"key_angles":[{"joint":"lumbar_extension","min_degrees":10,"max_degrees":35,"landmark_indices":[11,23,25]}],"alignment_cues":[{"condition":"extension","feedback_good":"Good spinal extension ✓","feedback_warn":"Keep your neck in line with your spine"}],"common_mistakes":["Crunching lower back","Squeezing glutes too hard","Neck jutting forward"]}',
 false),
('Child''s Pose Hold',
 'A restorative stretch that lengthens the spine and releases the lower back and hips.',
 ARRAY['Kneel with knees hip-width apart, big toes touching','Sit back toward heels','Walk hands forward, lower chest toward mat','Hold and breathe deeply into your back body','Let forehead rest on mat'],
 ARRAY['latissimus_dorsi','quadratus_lumborum','hip_extensors'],
 'spine', 'gentle', 'hold', 45,
 null,
 false),
('Rolling Like a Ball',
 'A massage for the spine that challenges balance and builds body awareness.',
 ARRAY['Sit at edge of mat, knees to chest','Hold shins, curl spine into a C-curve','Balance on tailbone, feet off mat','Inhale, roll back to shoulder blades (not neck)','Exhale, roll up to balance','Use your core to control the movement — do not use momentum'],
 ARRAY['deep_abdominals','hip_flexors','spinal_extensors'],
 'core', 'moderate', 'reps', 8,
 '{"key_angles":[],"alignment_cues":[{"condition":"c_curve","feedback_good":"C-curve maintained ✓","feedback_warn":"Keep your chin tucked to protect your neck"}],"common_mistakes":["Rolling onto neck","Losing C-curve at top"]}',
 false),
('Hundred',
 'The signature Pilates warm-up that activates the deep core and gets circulation flowing.',
 ARRAY['Lie on back, legs in tabletop (90°) or extended at 45°','Curl head and shoulders off mat, gaze at knees','Arms long by your sides, hover above mat','Pump arms up and down 2 inches in a controlled rhythm','Inhale for 5 pumps, exhale for 5 pumps — 100 total'],
 ARRAY['transverse_abdominis','rectus_abdominis','hip_flexors'],
 'core', 'moderate', 'reps', 100,
 '{"key_angles":[{"joint":"hip_flexion","min_degrees":45,"max_degrees":90,"landmark_indices":[23,25,27]}],"alignment_cues":[{"condition":"curl_up","feedback_good":"Good curl-up position ✓","feedback_warn":"Keep lower back pressed into mat"}],"common_mistakes":["Neck strain","Lower back arching","Breath held"]}',
 false),
('Single Leg Stretch',
 'A dynamic core exercise that challenges coordination and deep abdominal control.',
 ARRAY['Lie on back, curl head and shoulders off mat','Bring right knee to chest, extend left leg to 45°','Right hand on right ankle, left hand on right knee','Switch legs in a cycling motion','Keep lower back imprinted on mat throughout'],
 ARRAY['rectus_abdominis','transverse_abdominis','hip_flexors'],
 'core', 'moderate', 'reps', 10,
 '{"key_angles":[{"joint":"hip_extension","min_degrees":40,"max_degrees":60,"landmark_indices":[23,25,27]}],"alignment_cues":[{"condition":"leg_extension","feedback_good":"Core engaged ✓","feedback_warn":"Lower your leg if lower back lifts"}],"common_mistakes":["Losing curl-up","Pulling on neck","Jerky movement"]}',
 false),
('Plank Hold',
 'Full-body stability that builds core endurance and shoulder strength.',
 ARRAY['Start on hands or forearms, wrists under shoulders','Step feet back to a long line','Draw navel toward spine','Keep hips level — no piking or sagging','Breathe naturally, hold with intention'],
 ARRAY['transverse_abdominis','serratus_anterior','glutes','quadriceps'],
 'core', 'challenging', 'hold', 30,
 '{"key_angles":[{"joint":"hip_alignment","min_degrees":-5,"max_degrees":5,"landmark_indices":[11,23,25]}],"alignment_cues":[{"condition":"hip_neutral","feedback_good":"Hips level ✓","feedback_warn":"Lower your hips slightly"}],"common_mistakes":["Hips piking","Lower back sagging","Breath holding"]}',
 true),
('Dead Bug',
 'A deep stabilisation exercise that trains the core to resist rotation and extension.',
 ARRAY['Lie on back, arms to ceiling, knees above hips at 90°','Press lower back firmly into mat','Inhale to prepare','Exhale, slowly lower right arm and left leg toward mat','Return to start, switch sides','Lower back must stay on mat throughout'],
 ARRAY['transverse_abdominis','multifidus','obliques'],
 'core', 'moderate', 'reps', 8,
 null,
 false),
('Hip Flexor Release (Lunge Stretch)',
 'A deep stretch for the iliopsoas and hip flexors — essential after sitting or recovery.',
 ARRAY['Step right foot forward into a low lunge','Lower left knee to mat (use a pad if needed)','Tuck pelvis gently under, feel stretch in left hip','Raise arms or keep hands on front knee','Hold and breathe — let the hip release with each exhale'],
 ARRAY['iliopsoas','rectus_femoris','hip_flexors'],
 'hips', 'gentle', 'hold', 40,
 null,
 false),
('Clamshell',
 'Activates the hip abductors and external rotators — key for knee and lower back health.',
 ARRAY['Lie on your side, knees stacked, bent to 90°','Head rests on bottom arm','Keeping feet together, lift top knee toward ceiling','Rotate from the hip — do not roll back','Lower with control, repeat then switch sides'],
 ARRAY['gluteus_medius','piriformis','hip_external_rotators'],
 'hips', 'gentle', 'reps', 15,
 '{"key_angles":[{"joint":"hip_abduction","min_degrees":30,"max_degrees":50,"landmark_indices":[23,25,27]}],"alignment_cues":[{"condition":"abduction","feedback_good":"Good hip rotation ✓","feedback_warn":"Don''t roll your pelvis backward"}],"common_mistakes":["Rolling pelvis","Not going through full range","Rushing"]}',
 false),
('Glute Bridge',
 'Activates the glutes and hamstrings while stabilising the lower back.',
 ARRAY['Lie on back, knees bent, feet hip-width apart','Arms by sides, palms down','Inhale to prepare','Exhale, press through heels to lift hips off mat','Squeeze glutes at top, keep spine long','Lower vertebra by vertebra on inhale'],
 ARRAY['gluteus_maximus','hamstrings','transverse_abdominis'],
 'hips', 'gentle', 'reps', 12,
 '{"key_angles":[{"joint":"hip_extension","min_degrees":160,"max_degrees":180,"landmark_indices":[23,25,27]}],"alignment_cues":[{"condition":"bridge","feedback_good":"Hips level ✓","feedback_warn":"Keep both hips even — check for one side dropping"}],"common_mistakes":["Hyperextending spine","Knees falling in","Feet too far from hips"]}',
 false),
('Fire Hydrant',
 'Strengthens hip abductors and improves hip mobility in multiple planes.',
 ARRAY['Start on hands and knees, wrists under shoulders','Keeping knee bent at 90°, lift right leg out to side','Hip height — no higher','Slowly lower with control','Keep spine neutral throughout — no tilting'],
 ARRAY['gluteus_medius','tensor_fasciae_latae','hip_abductors'],
 'hips', 'moderate', 'reps', 12,
 null,
 false),
('Piriformis Stretch',
 'Releases the deep hip rotators and eases sciatic nerve tension.',
 ARRAY['Lie on back, both knees bent','Cross right ankle over left knee (figure-four shape)','Either stay here or draw both legs toward chest','Hold and breathe — deepen the stretch on each exhale','Switch sides'],
 ARRAY['piriformis','deep_hip_rotators','gluteus_medius'],
 'hips', 'gentle', 'hold', 45,
 null,
 false),
('Shoulder Rolls',
 'Releases tension in the neck and shoulders and improves scapular mobility.',
 ARRAY['Sit or stand tall','Inhale, draw shoulders up toward ears','Exhale, roll shoulders back and down','Feel chest open with each backward roll','Reverse direction: forward, up, back, down'],
 ARRAY['trapezius','rhomboids','serratus_anterior'],
 'shoulders', 'gentle', 'reps', 10,
 null,
 false),
('Thread the Needle',
 'A rotational stretch for the thoracic spine and shoulder that releases upper back tightness.',
 ARRAY['Start on hands and knees','Slide right arm under body along mat, palm up','Let right shoulder and ear rest on mat','Feel the stretch through your upper back and shoulder','Stay or deepen by reaching right arm forward','Hold, then return and switch sides'],
 ARRAY['thoracic_rotators','posterior_shoulder','rhomboids'],
 'shoulders', 'gentle', 'hold', 35,
 null,
 false),
('Chest Opener (Arms Behind)',
 'Counteracts forward rounding posture by opening the chest and front of shoulders.',
 ARRAY['Sit or stand tall','Interlace fingers behind your back or hold a strap','Draw shoulder blades together, lift chest','Without crunching lower back, gently lift hands away from body','Hold and breathe into the front of your chest'],
 ARRAY['pectorals','anterior_deltoid','biceps'],
 'shoulders', 'gentle', 'hold', 30,
 null,
 false),
('Serratus Punch',
 'Activates serratus anterior — the muscle that holds the shoulder blade against the ribcage.',
 ARRAY['Lie on back, arms to ceiling, fingers spread','Keep lower back on mat','Reach arms further toward ceiling — feel shoulder blades spread apart','Slowly reverse, let shoulder blades pinch together','Control both directions — this is a small but important movement'],
 ARRAY['serratus_anterior','subscapularis'],
 'shoulders', 'moderate', 'reps', 10,
 null,
 true),
('Side-Lying Neck Stretch',
 'Gently lengthens the neck and upper trapezius on each side.',
 ARRAY['Lie on your side or sit tall','Let right ear drop toward right shoulder','Keep left shoulder heavy and relaxed — do not hunch','For a deeper stretch, place right hand gently on left side of head','Hold and breathe, then switch sides'],
 ARRAY['upper_trapezius','levator_scapulae','scalenes'],
 'shoulders', 'gentle', 'hold', 30,
 null,
 false),
('Pilates Push-Up',
 'A full-body strength exercise that challenges the core, chest, and arms together.',
 ARRAY['Start standing, fold forward to mat (bend knees if needed)','Walk hands out to plank position','Lower chest toward mat in one long line','Press back up, maintain core engagement throughout','Walk hands back to feet, roll up slowly'],
 ARRAY['pectorals','triceps','transverse_abdominis','serratus_anterior'],
 'full_body', 'challenging', 'reps', 8,
 '{"key_angles":[{"joint":"elbow_flexion","min_degrees":60,"max_degrees":90,"landmark_indices":[11,13,15]}],"alignment_cues":[{"condition":"lowering","feedback_good":"Body in one line ✓","feedback_warn":"Keep hips level with shoulders"}],"common_mistakes":["Hips piking","Elbows flaring","Core disengaged"]}',
 true),
('Teaser Prep',
 'Builds toward the full Pilates Teaser by training balance, hip flexor strength, and abdominals.',
 ARRAY['Lie on back, knees bent, feet off mat at tabletop','Arms reach long by ears','Inhale to prepare','Exhale, curl up — arms reach toward knees','Balance on tailbone, hold 2 breaths','Roll back down with control'],
 ARRAY['rectus_abdominis','hip_flexors','spinal_extensors'],
 'full_body', 'moderate', 'reps', 6,
 null,
 true),
('Mermaid Stretch',
 'A lateral side stretch that opens the waist, ribs, and obliques.',
 ARRAY['Sit with both legs folded to one side (or cross-legged)','Right hand on mat for support','Inhale, reach left arm up alongside your ear','Exhale, side-bend toward right hand, lengthening left side','Hold 2 breaths, then return and switch sides'],
 ARRAY['obliques','quadratus_lumborum','intercostals'],
 'full_body', 'gentle', 'hold', 35,
 null,
 false),
('Supine Spinal Twist',
 'A passive, restorative twist that releases the lower back, hips, and IT band.',
 ARRAY['Lie on back, draw right knee to chest','Let knee fall across to the left side of the body','Extend right arm out to the right, gaze right','Left hand rests on right knee — gently guide, do not force','Stay 5–8 breaths, then switch sides'],
 ARRAY['piriformis','IT_band','obliques','lower_back'],
 'cool_down', 'gentle', 'hold', 40,
 null,
 false),
('Legs Up the Wall',
 'An inversion that drains the legs, calms the nervous system, and eases lower back tension.',
 ARRAY['Sit sideways next to a wall, hip close to it','Swing legs up as you lie back','Rest legs against wall, arms by sides','Relax completely and breathe','Stay 2–5 minutes'],
 ARRAY['hamstrings','calves','lower_back','nervous_system'],
 'cool_down', 'gentle', 'hold', 120,
 null,
 false),
('Constructive Rest',
 'Semi-supine position that allows the spine to decompress and muscles to completely release.',
 ARRAY['Lie on back, knees bent, feet flat and hip-width apart','Arms rest comfortably on lower abdomen','Close eyes, soften jaw, release tongue from roof of mouth','Let your back widen and lengthen into the mat','Breathe naturally — stay 3–5 minutes'],
 ARRAY['paraspinals','psoas','diaphragm'],
 'cool_down', 'gentle', 'hold', 180,
 null,
 false),
('Doorway Chest Stretch',
 'Opens tight pectorals and anterior deltoids — essential for desk workers and new mothers.',
 ARRAY['Stand in a doorway, arms at 90° on doorframe','Step one foot through, gently shift weight forward','Feel the stretch across your chest and front of shoulders','Do not push into pain — this should feel like a deep release','Hold, breathe, then switch leading foot'],
 ARRAY['pectorals','anterior_deltoid','coracobrachialis'],
 'cool_down', 'gentle', 'hold', 30,
 null,
 false),
('Diaphragmatic Breathing',
 'Activates the parasympathetic nervous system and teaches correct breathing mechanics.',
 ARRAY['Lie on back or sit comfortably','Place one hand on chest, one on belly','Inhale slowly through nose — belly rises, chest stays still','Exhale slowly through mouth — belly falls','Aim for 4 counts in, 6 counts out','Do 10 complete breath cycles'],
 ARRAY['diaphragm','transverse_abdominis','pelvic_floor'],
 'cool_down', 'gentle', 'reps', 10,
 null,
 false),
('Pelvic Floor Activation',
 'Reconnects the deep pelvic floor muscles — vital for postnatal recovery and core health.',
 ARRAY['Lie on back, knees bent, feet flat','Take a natural breath','On exhale, gently draw up and in — as if stopping the flow of urine','Hold for 5 seconds, fully release for 5 seconds','Do not hold breath or squeeze glutes','Repeat 10 times'],
 ARRAY['pelvic_floor','transverse_abdominis'],
 'core', 'gentle', 'reps', 10,
 null,
 false),
('Thoracic Rotation in Sitting',
 'Restores mid-back rotation that is often lost after pregnancy, injury, or prolonged sitting.',
 ARRAY['Sit tall on a chair or mat','Cross arms over chest or place hands behind head','Inhale to grow tall','Exhale, rotate right from your mid-back only — hips stay forward','Return to centre, switch sides','Move slowly and with intention'],
 ARRAY['thoracic_rotators','obliques','multifidus'],
 'spine', 'gentle', 'reps', 10,
 null,
 false),
('Wall Angels',
 'Trains scapular upward rotation and thoracic extension against gravity — key for posture.',
 ARRAY['Stand with back flat against wall, feet a few inches out','Press lower back, upper back, and head into wall','Raise arms to a W shape — elbows and wrists touching wall','Slowly slide arms up toward a Y shape, keeping contact with wall','Lower back to W with control — this is one rep'],
 ARRAY['lower_trapezius','serratus_anterior','rhomboids','thoracic_extensors'],
 'shoulders', 'moderate', 'reps', 10,
 null,
 true)
on conflict (name) do nothing;

-- ───────────────────────────────────────────────────────────────
--  SEED — Session Plans (idempotent via ON CONFLICT (name))
-- ───────────────────────────────────────────────────────────────
insert into public.session_plans
  (name, description, category, difficulty, duration_minutes, goals, focus_areas, is_pro, thumbnail_emoji, thumbnail_color)
values
('Spinal Mobility & Deep Core',
 'Gentle spinal articulation combined with deep core activation. Perfect for recovery days or returning to movement after a break.',
 'spine', 'moderate', 28,
 ARRAY['recovery','alignment'],
 ARRAY['lower_back','core_pelvic'],
 false, '🌿', 'from-sage-dark to-sage'),
('Shoulder & Neck Release',
 'A targeted flow for the upper body. Releases neck tension, opens the chest, and resets rounded-shoulder posture.',
 'shoulders', 'gentle', 22,
 ARRAY['recovery','alignment'],
 ARRAY['neck_shoulders'],
 false, '🧘‍♀️', 'from-rose to-rose-dark'),
('Core Activation',
 'Progressive deep core work that builds a strong foundation without stressing the spine.',
 'core', 'moderate', 25,
 ARRAY['strength','recovery'],
 ARRAY['core_pelvic'],
 false, '💪', 'from-green-600 to-green-800'),
('Evening Wind-Down',
 'A slow, restorative sequence to decompress the spine and calm the nervous system before sleep.',
 'cool_down', 'gentle', 18,
 ARRAY['flexibility','recovery'],
 ARRAY['lower_back','hips'],
 false, '🌙', 'from-purple-400 to-purple-700'),
('Hip Flexor & Lower Back Flow',
 'Targets the most common tension areas from sitting and daily life. Great for lower back pain relief.',
 'hips', 'gentle', 20,
 ARRAY['recovery','flexibility'],
 ARRAY['lower_back','hips'],
 false, '🦋', 'from-amber-500 to-amber-700'),
('Full Body Pilates — Moderate',
 'A complete full-body session using classic Pilates repertoire. Builds strength, improves alignment, and leaves you feeling reset.',
 'full_body', 'moderate', 35,
 ARRAY['strength','alignment','flexibility'],
 ARRAY['core_pelvic','lower_back','neck_shoulders'],
 true, '⭐', 'from-sage to-sage-dark'),
('Postnatal Foundation',
 'Gentle reconnection for the postnatal body. Focus on breath, pelvic floor, and foundational core without strain.',
 'core', 'gentle', 20,
 ARRAY['recovery'],
 ARRAY['core_pelvic','lower_back'],
 true, '🌸', 'from-rose-light to-rose')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────────────────────
--  SEED — Plan → Exercise links (the missing join data)
--  Matched by name so it works regardless of generated UUIDs.
-- ───────────────────────────────────────────────────────────────
insert into public.session_plan_exercises (session_plan_id, exercise_id, order_index)
select sp.id, ex.id, v.ord
from (values
  -- Spinal Mobility & Deep Core
  ('Spinal Mobility & Deep Core', 'Cat-Cow Stretch',        0),
  ('Spinal Mobility & Deep Core', 'Pelvic Tilts',           1),
  ('Spinal Mobility & Deep Core', 'Spine Twist',            2),
  ('Spinal Mobility & Deep Core', 'Swan Prep',              3),
  ('Spinal Mobility & Deep Core', 'Single Leg Stretch',     4),
  ('Spinal Mobility & Deep Core', 'Child''s Pose Hold',     5),
  -- Shoulder & Neck Release
  ('Shoulder & Neck Release', 'Shoulder Rolls',             0),
  ('Shoulder & Neck Release', 'Side-Lying Neck Stretch',    1),
  ('Shoulder & Neck Release', 'Thread the Needle',          2),
  ('Shoulder & Neck Release', 'Chest Opener (Arms Behind)', 3),
  ('Shoulder & Neck Release', 'Doorway Chest Stretch',      4),
  -- Core Activation
  ('Core Activation', 'Pelvic Tilts',                       0),
  ('Core Activation', 'Dead Bug',                           1),
  ('Core Activation', 'Hundred',                            2),
  ('Core Activation', 'Single Leg Stretch',                 3),
  ('Core Activation', 'Plank Hold',                         4),
  ('Core Activation', 'Pelvic Floor Activation',            5),
  -- Evening Wind-Down
  ('Evening Wind-Down', 'Supine Spinal Twist',              0),
  ('Evening Wind-Down', 'Child''s Pose Hold',               1),
  ('Evening Wind-Down', 'Legs Up the Wall',                 2),
  ('Evening Wind-Down', 'Constructive Rest',                3),
  ('Evening Wind-Down', 'Diaphragmatic Breathing',          4),
  -- Hip Flexor & Lower Back Flow
  ('Hip Flexor & Lower Back Flow', 'Hip Flexor Release (Lunge Stretch)', 0),
  ('Hip Flexor & Lower Back Flow', 'Clamshell',             1),
  ('Hip Flexor & Lower Back Flow', 'Glute Bridge',          2),
  ('Hip Flexor & Lower Back Flow', 'Piriformis Stretch',    3),
  ('Hip Flexor & Lower Back Flow', 'Supine Spinal Twist',   4),
  -- Full Body Pilates — Moderate
  ('Full Body Pilates — Moderate', 'Cat-Cow Stretch',       0),
  ('Full Body Pilates — Moderate', 'Hundred',               1),
  ('Full Body Pilates — Moderate', 'Single Leg Stretch',    2),
  ('Full Body Pilates — Moderate', 'Glute Bridge',          3),
  ('Full Body Pilates — Moderate', 'Plank Hold',            4),
  ('Full Body Pilates — Moderate', 'Pilates Push-Up',       5),
  ('Full Body Pilates — Moderate', 'Swan Prep',             6),
  ('Full Body Pilates — Moderate', 'Mermaid Stretch',       7),
  -- Postnatal Foundation
  ('Postnatal Foundation', 'Diaphragmatic Breathing', 0),
  ('Postnatal Foundation', 'Pelvic Floor Activation', 1),
  ('Postnatal Foundation', 'Pelvic Tilts',           2),
  ('Postnatal Foundation', 'Glute Bridge',           3),
  ('Postnatal Foundation', 'Constructive Rest',      4)
) as v(plan_name, ex_name, ord)
join public.session_plans sp on sp.name = v.plan_name
join public.exercises     ex on ex.name = v.ex_name
on conflict (session_plan_id, order_index) do nothing;

-- ───────────────────────────────────────────────────────────────
--  Refresh PostgREST schema cache so the API sees new columns now.
-- ───────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
