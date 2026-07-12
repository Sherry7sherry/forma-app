// ── User & Auth ─────────────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  subscription_status: 'free' | 'pro' | 'founding'
  subscription_end_date: string | null
  stripe_customer_id: string | null
  health_disclaimer_accepted_at: string | null
  voice_coaching_enabled: boolean
  created_at: string
}

export interface OnboardingData {
  goals: Goal[]
  experience_level: ExperienceLevel
  focus_areas: FocusArea[]
  sessions_per_week: number
}

export type Goal = 'recovery' | 'alignment' | 'strength' | 'flexibility'
export type ExperienceLevel = 'beginner' | 'some' | 'regular' | 'advanced'
export type FocusArea = 'lower_back' | 'neck_shoulders' | 'hips' | 'core_pelvic' | 'knees' | 'ankles_feet'

// ── Exercises ───────────────────────────────────────────────────
export interface Exercise {
  id: string
  name: string
  description: string
  instructions: string[]
  target_muscles: string[]
  category: ExerciseCategory
  difficulty: Difficulty
  duration_type: 'reps' | 'hold'
  default_reps: number       // reps or seconds for hold
  video_url: string | null
  thumbnail_url: string | null
  pose_definition: PoseDefinition | null
  is_pro: boolean
  created_at: string
}

export type ExerciseCategory = 'core' | 'spine' | 'hips' | 'shoulders' | 'full_body' | 'cool_down'
export type Difficulty = 'gentle' | 'moderate' | 'challenging'

export interface PoseDefinition {
  key_angles: KeyAngle[]
  alignment_cues: AlignmentCue[]
  common_mistakes: string[]
}

export interface KeyAngle {
  joint: string          // e.g. "left_knee", "spine"
  min_degrees: number
  max_degrees: number
  landmark_indices: [number, number, number]  // MediaPipe landmark indices
}

export interface AlignmentCue {
  condition: string      // e.g. "spine_neutral"
  feedback_good: string  // "Spine aligned ✓"
  feedback_warn: string  // "Tuck your chin slightly"
}

// ── Sessions ────────────────────────────────────────────────────
export interface SessionPlan {
  id: string
  name: string
  description: string
  category: ExerciseCategory
  difficulty: Difficulty
  duration_minutes: number
  goals: Goal[]
  focus_areas: FocusArea[]
  exercises: SessionExercise[]
  is_pro: boolean
  thumbnail_emoji: string
  thumbnail_color: string  // tailwind gradient classes
  created_at: string
}

export interface SessionExercise {
  exercise_id: string
  exercise: Exercise
  order: number
  reps_override: number | null
  rest_after_seconds: number
}

// ── Session Records (completed sessions) ────────────────────────
export interface SessionRecord {
  id: string
  user_id: string
  session_plan_id: string
  session_plan: SessionPlan
  started_at: string
  completed_at: string | null
  duration_seconds: number
  form_score: number           // 0–100
  reps_completed: number
  exercises_completed: number
  ai_feedback: string | null
  body_feel_before: BodyFeel | null
  body_feel_after: BodyFeel | null
  exercise_scores: ExerciseScore[]
}

export type BodyFeel = 'tight' | 'okay' | 'good' | 'great'

export interface ExerciseScore {
  exercise_id: string
  form_score: number
  reps_completed: number
  flags: string[]  // e.g. ["left_hip_compensation"]
}

// ── Progress ────────────────────────────────────────────────────
export interface WeeklyStats {
  week_start: string
  sessions_count: number
  total_minutes: number
  avg_form_score: number
  streak_days: number
}

export interface FocusAreaProgress {
  area: FocusArea
  score_current: number
  score_four_weeks_ago: number
  improvement_pct: number
}

export interface InternalTestRunRecord {
  id: string; tester_id: string; source_flow: 'assessment' | 'session' | 'directed'
  build_version: string; profile_version: string; environment: Record<string, unknown>
  status: string; started_at: string; ended_at: string | null
}

export interface InternalTestAttemptRecord {
  id: string; run_id: string; movement_id: string; movement_kind: 'assessment' | 'exercise'
  phase: string; status: string; synthetic: boolean; summary: Record<string, unknown>
  started_at: string; ended_at: string | null
}

// ── Stripe ──────────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: 'free' | 'pro_monthly' | 'pro_yearly' | 'founding'
  name: string
  price_monthly: number
  price_yearly?: number
  stripe_price_id: string | null
  features: string[]
  session_limit_weekly: number | null  // null = unlimited
  ai_camera: boolean
}
