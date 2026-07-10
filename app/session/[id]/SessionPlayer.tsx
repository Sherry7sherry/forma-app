'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ScanLine, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { assertSupabaseSuccess } from '@/lib/supabaseErrors'
import { formatDuration } from '@/lib/utils'
import { createVoiceCoach, type VoiceCue } from '@/lib/voiceCoach'
import { getCue } from '@/lib/coach/cues'
import { fallbackSummary } from '@/lib/coach/fallbacks'
import { requestSessionSummary } from '@/lib/coach/requestSummary'
import { buildSummaryInput } from '@/lib/coach/summaryInput'
import type { SessionSummary } from '@/lib/coach/types'
import type { Locale } from '@/lib/i18n'
import { FLOOR_EXERCISE_NAMES, getExerciseTrackingProfile } from '@/lib/exerciseTracking'
import { hasTrackingCoverage, isWithinTrackingGrace, normalizedPoseDistance } from '@/lib/poseTracking'
import { UpgradeButton } from '@/components/billing/BillingButton'
import type { SessionBodyPolicy } from '@/lib/bodyMirror'
import type { TrainingEntitlement } from '@/lib/subscriptionEntitlement'
import { trackAssessmentEvent } from '@/lib/assessmentAnalytics'
import type { SessionPlan } from '@/types'

const PoseCamera = dynamic(() => import('@/components/camera/PoseCamera'), { ssr: false })

type Phase =
  | 'pre-start'
  | 'camera-guide'
  | 'exercise-intro'   // shown for first exercise and "Review setup"
  | 'active'
  | 'transition'
  | 'skip-confirm'
  | 'exit-confirm'
  | 'finished'

interface Props {
  plan: SessionPlan
  userId: string
  isPro: boolean
  voiceCoachingEnabled: boolean
  locale: Locale
  sessionsThisWeek: number
  bodyPolicy: SessionBodyPolicy
  entitlement: TrainingEntitlement
  isPersonalizedIntro: boolean
  reportId: string | null
  partialSession?: {
    id: string
    lastExerciseIndex: number
    exercisesCompleted: number
    totalExercises: number
    savedAt: string   // ISO timestamp
  } | null
}

const FREE_SESSION_LIMIT = 3
const TRANSITION_COUNTDOWN = 5
// Seconds of stable full-body framing before a Pro AI session auto-starts the
// exercise. Mirrors the MVP's "hold steady, auto-start" calibration step.
const CALIB_HOLD_SECONDS = 3
const START_ANYWAY_DELAY_MS = 8_000

// Active-phase sub-stages (Pro AI camera only). `calibrating` is the camera-first
// "get your whole body in frame" gate; `exercising` is the live, counted exercise.
// Free sessions skip straight to `exercising` (no camera to calibrate).
type ActiveStage = 'calibrating' | 'exercising'

interface CalibrationBlocker {
  title: string
  detail: string
  stats: string
  voice: VoiceCue
}

const REP_COOLDOWN_MS      = 700    // minimum ms between two counted reps — prevents double-counting
const MOVEMENT_TIMEOUT_MS  = 12_000    // how long to wait at baseline before nudging "movement not detected yet"
const REP_COUNTED_DISPLAY_MS = 800    // how long the "+1" confirmation lingers before reverting
const DEBUG_LOG_LIMIT = 2_500
const DEBUG_POSE_LOG_INTERVAL_MS = 500

// ── AI rep-counting state machine ──────────────────────────────────
// Treats rep counting as explicit states (not a silent threshold check) so
// the same source of truth drives the on-screen status, the spoken/voice
// prompt, and the rep-count behavior. `framingDetail` further classifies
// *why* tracking isn't reliable right now, for the framing-specific copy
// the user asked for ("Full body not visible" vs "Upper body only" vs
// "Tracking confidence too low").
type AiRepPhase =
  | 'unsupported_exercise'      // this exercise's movement is too subtle for camera tracking
  | 'waiting_for_full_body'     // haven't yet achieved a confident reading this exercise
  | 'ready_for_baseline'        // just got a confident frame — capturing the neutral pose
  | 'waiting_for_engaged_phase' // baseline set; waiting for the body to move away from it
  | 'waiting_for_return_phase'  // moved away from baseline; waiting for the return to complete the rep
  | 'rep_counted'               // brief confirmation state right after a rep completes
  | 'tracking_lost'             // was tracking confidently, then framing degraded mid-exercise

type FramingDetail = 'no-body' | 'upper-body' | 'low-confidence' | null

interface AiRepStatus {
  chip: string
  tone: 'tracking' | 'attention' | 'success' | 'muted'
  message: string
  voice?: VoiceCue
}

type DebugEventType = 'pose_update' | 'phase_change' | 'count' | 'quality_cue' | 'blocker'

interface DebugLogEntry {
  exerciseName: string
  timestamp: string
  aiRepPhase: AiRepPhase
  framingStatus: string
  bodyConfidence: number
  visibleLandmarks: number
  requiredLandmarks: number
  delta: number
  engageThreshold: number
  returnThreshold: number
  repCount: number
  qualityCue: string | null
  eventType: DebugEventType
}

/** Single source of truth for on-screen copy + spoken prompt, keyed off the state machine. */
function describeAiRepStatus(phase: AiRepPhase, detail: FramingDetail, movementStale: boolean): AiRepStatus {
  switch (phase) {
    // ── Voice prompts match spec verbatim throughout ───────────────────────
    case 'unsupported_exercise':
      return {
        chip: 'Manual counting for now',
        tone: 'muted',
        message: 'This exercise requires manual counting for now — AI form feedback is still active.',
        voice: { key: 'unsupported', text: 'This movement needs manual counting for now.', cooldownMs: 45_000 },
      }

    case 'waiting_for_full_body':
    case 'tracking_lost': {
      const isLost = phase === 'tracking_lost'
      if (detail === 'upper-body') {
        return {
          chip: 'Step back',
          tone: 'attention',
          message: 'Step back, I need your full body.',
          voice: { key: 'upper-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
        }
      }
      if (detail === 'low-confidence') {
        return {
          chip: 'Low confidence',
          tone: 'attention',
          message: 'Improve lighting or slow down.',
          voice: { key: 'tracking-low-confidence', text: 'Improve lighting or slow down.', cooldownMs: 8_000 },
        }
      }
      return {
        chip: isLost ? 'Tracking lost' : 'Full body needed',
        tone: 'attention',
        message: 'Step back, I need your full body.',
        voice: { key: 'full-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
      }
    }

    case 'ready_for_baseline':
      // "I can see your full body. Start when you're ready." — fires once when we first
      // achieve confident framing after waiting. Relatively long cooldown so it's not
      // repeated if tracking briefly dips and recovers.
      return {
        chip: 'Getting ready…',
        tone: 'tracking',
        message: "Full body visible — hold your starting position for a moment.",
        voice: { key: 'ready', text: "I can see your full body. Start when you're ready.", cooldownMs: 20_000 },
      }

    case 'waiting_for_engaged_phase':
      if (movementStale) {
        return {
          chip: 'Movement not detected yet',
          tone: 'attention',
          message: 'Move a little bigger.',
          voice: { key: 'movement-stale', text: 'Move a little bigger.', cooldownMs: 8_000 },
        }
      }
      return {
        chip: 'AI counting reps',
        tone: 'tracking',
        message: "AI is tracking you — go ahead whenever you're ready.",
      }

    case 'waiting_for_return_phase':
      return {
        chip: 'Return to start',
        tone: 'tracking',
        message: 'Return to start.',
        voice: { key: 'return-phase', text: 'Return to start.', cooldownMs: 4_000 },
      }

    case 'rep_counted':
      return {
        chip: 'Counted +1',
        tone: 'success',
        message: 'Counted.',
        voice: { key: `rep-counted-${Date.now()}`, text: 'Good.', cooldownMs: 0 },
      }
  }
}

type RepCycleStage = 'Start' | 'Move' | 'Return' | 'Count'

function repCycleStage(phase: AiRepPhase): RepCycleStage {
  if (phase === 'waiting_for_return_phase') return 'Return'
  if (phase === 'rep_counted') return 'Count'
  if (phase === 'waiting_for_engaged_phase') return 'Move'
  return 'Start'
}

function requiredVisibleLandmarks(profile: ReturnType<typeof getExerciseTrackingProfile>): number {
  return Math.min(
    profile.landmarks.length,
    Math.max(
      profile.minVisibleLandmarks,
      Math.ceil(profile.landmarks.length * profile.minVisibleRatio),
    ),
  )
}

function describeCalibrationBlocker({
  orientationReady,
  expectedOrientation,
  actualOrientation,
  framingStatus,
  confidence,
  confidenceThreshold,
  visibleCount,
  requiredCount,
  landmarksReady,
}: {
  orientationReady: boolean
  expectedOrientation: 'portrait' | 'landscape' | 'either'
  actualOrientation?: 'portrait' | 'landscape'
  framingStatus: string
  confidence: number
  confidenceThreshold: number
  visibleCount: number
  requiredCount: number
  landmarksReady: boolean
}): CalibrationBlocker {
  const stats = `Visible ${visibleCount}/${requiredCount} key points · confidence ${Math.round(confidence * 100)}%`

  if (!orientationReady && expectedOrientation !== 'either') {
    const direction = expectedOrientation === 'landscape' ? 'landscape' : 'portrait'
    return {
      title: `Rotate your phone to ${direction}`,
      detail: actualOrientation
        ? `I see ${actualOrientation}, but this exercise needs ${direction} so your whole body fits.`
        : `This exercise needs ${direction} so your whole body fits.`,
      stats,
      voice: { key: `calib-orientation-${direction}`, text: `Rotate your phone to ${direction}.`, cooldownMs: 10_000 },
    }
  }

  if (framingStatus === 'no-body') {
    return {
      title: 'No body detected',
      detail: 'Step into the camera view, then pause for a moment.',
      stats,
      voice: { key: 'calib-no-body', text: 'Step into view, then pause for a moment.', cooldownMs: 10_000 },
    }
  }

  if (framingStatus === 'upper-body') {
    return {
      title: 'Only upper body visible',
      detail: 'Step back or lower the phone so hips, knees, and feet are visible too.',
      stats,
      voice: { key: 'calib-upper-body', text: 'Step back until I can see your legs.', cooldownMs: 10_000 },
    }
  }

  if (framingStatus === 'partial') {
    return {
      title: 'Partially out of frame',
      detail: 'Step back until your head, hips, knees, and feet all stay inside the view.',
      stats,
      voice: { key: 'calib-partial', text: 'Lower the camera or step back.', cooldownMs: 10_000 },
    }
  }

  if (confidence < confidenceThreshold) {
    return {
      title: 'Confidence too low',
      detail: 'Improve lighting, keep the phone steady, or slow down while setting up.',
      stats,
      voice: { key: 'calib-low-confidence', text: 'Improve the lighting and hold still.', cooldownMs: 10_000 },
    }
  }

  if (!landmarksReady) {
    return {
      title: 'Need more key points visible',
      detail: `Only ${visibleCount} of ${requiredCount} key points visible. Step back or adjust the camera angle.`,
      stats,
      voice: { key: 'calib-key-points', text: 'Adjust the camera so I can see more of you.', cooldownMs: 10_000 },
    }
  }

  return {
    title: 'Camera ready',
    detail: 'Hold still. I will start automatically.',
    stats,
    voice: { key: 'calib-ready', text: 'Good. Hold still.', cooldownMs: 20_000 },
  }
}

function detectQualityCue(exerciseName: string | undefined, landmarks: any[]): string | null {
  if (!exerciseName || !landmarks?.length) return null

  const leftEar = landmarks[7]
  const rightEar = landmarks[8]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const leftKnee = landmarks[25]
  const rightKnee = landmarks[26]

  if (exerciseName === 'Glute Bridge') {
    if (leftHip && rightHip && Math.abs(leftHip.y - rightHip.y) > 0.045) return 'Keep both hips level'
    if (leftKnee && rightKnee && leftHip && rightHip && Math.abs(leftKnee.x - rightKnee.x) < Math.abs(leftHip.x - rightHip.x) * 0.65) return 'Press knees forward'
    if (leftShoulder && rightShoulder && leftHip && rightHip) return 'Lift from your glutes'
  }

  if (exerciseName === 'Chest Lift') {
    if (leftEar && leftShoulder && Math.abs(leftEar.x - leftShoulder.x) > 0.12) return 'Keep your neck long'
    if (rightEar && rightShoulder && Math.abs(rightEar.x - rightShoulder.x) > 0.12) return 'Keep your neck long'
    if (leftShoulder && rightShoulder && leftHip && rightHip && Math.abs(leftShoulder.y - leftHip.y) < 0.18) return 'Soften your ribs'
    return 'Leave space under your chin'
  }

  return null
}

const CAMERA_GUIDES: Record<string, { position: string; distance: string; angle: string; tip: string }> = {
  spine:     { position: 'Side view', distance: '6–8 feet away', angle: 'Hip height', tip: 'Full body visible, head to feet' },
  core:      { position: 'Side view', distance: '5–6 feet away', angle: 'Floor level or low stool', tip: 'Lie on your mat — camera sees whole body' },
  hips:      { position: 'Side or front', distance: '5–6 feet away', angle: 'Knee height', tip: 'Both hips must be visible' },
  shoulders: { position: 'Front view', distance: '4–5 feet away', angle: 'Shoulder height', tip: 'Face camera, both shoulders visible' },
  full_body: { position: 'Side view', distance: '8–10 feet away', angle: 'Hip height', tip: 'You need extra space — move phone back' },
  cool_down: { position: 'Side view', distance: '5–6 feet away', angle: 'Floor level', tip: 'Lie on mat — full body from side' },
}

/** Per-exercise camera guidance overrides. Shown on the setup screen when the exercise name matches. */
const EXERCISE_CAMERA_GUIDES: Record<string, { position: string; distance: string; angle: string; tip: string }> = {
  'Cat-Cow Stretch':  { position: 'Side view (landscape)', distance: '8–10 feet away', angle: 'Mat level', tip: 'Phone in landscape mode to the side — your full spine from head to tailbone must be visible' },
  'Plank Hold':       { position: 'Side view (landscape)', distance: '8–10 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — head to heels in one line, fully visible' },
  "Child's Pose Hold":{ position: 'Side view (landscape)', distance: '6–8 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — hips, back, and extended arms must all be visible' },
  'Glute Bridge':     { position: 'Side view (landscape)', distance: '6–8 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side at mat height — head, hips, and feet must all be in frame' },
  'Pelvic Tilts':     { position: 'Side view (landscape)', distance: '6–8 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — lower back, hips, and knees must all be visible' },
  'Swan Prep':        { position: 'Side view (landscape)', distance: '8–10 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — full body lying face down must be visible' },
  'Hundred':          { position: 'Side view (landscape)', distance: '8–10 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — curled head and extended legs must both stay in frame' },
  'Single Leg Stretch':{ position: 'Side view (landscape)', distance: '8–10 feet away', angle: 'Mat level', tip: 'Phone in landscape to the side — the extended leg is the key part to keep in frame' },
  'Clamshell':        { position: 'Front or side (landscape)', distance: '5–6 feet away', angle: 'Mat level', tip: 'Phone in landscape facing you — stacked knees and rotating hip must both be visible' },
}

/**
 * Exercises performed lying/kneeling on a mat where the body is horizontal.
 * These need a landscape (16:9) camera view so the full body width stays in
 * frame — portrait (3:4) would crop the feet or head.
 */
const EXERCISE_CUES: Record<string, { start: string; watch: string; avoid: string }> = {
  'Pelvic Tilts':           { start: 'Lie on back, knees bent, feet flat', watch: 'Lower back presses into mat — small movement', avoid: 'Don\'t move upper body or hold breath' },
  'Cat-Cow Stretch':        { start: 'Hands and knees, wrists under shoulders', watch: 'Vertebra by vertebra — slow', avoid: 'Don\'t rush or only move lower back' },
  'Spine Twist':            { start: 'Sit tall, legs extended or crossed', watch: 'Rotate from mid-back, hips stay square', avoid: 'Don\'t lean — rotate, don\'t bend' },
  'Swan Prep':              { start: 'Face down, hands under shoulders', watch: 'Lift through chest, neck long', avoid: 'Don\'t crunch lower back' },
  'Child\'s Pose Hold':     { start: 'Kneel, big toes touching, knees wide', watch: 'Breathe into back body', avoid: 'Don\'t force — let gravity work' },
  'Hundred':                { start: 'On back, legs at 45°, head curled up', watch: '5-pump inhale, 5-pump exhale', avoid: 'Don\'t strain neck — gaze at knees' },
  'Single Leg Stretch':     { start: 'On back, head and shoulders curled up', watch: 'Switch smoothly, lower back on mat', avoid: 'Don\'t pull neck with hands' },
  'Glute Bridge':           { start: 'On back, knees bent, feet hip-width', watch: 'Press through heels, squeeze glutes', avoid: 'Don\'t hyperextend spine at top' },
  'Clamshell':              { start: 'On side, knees stacked and bent', watch: 'Rotate from hip, feet together', avoid: 'Don\'t roll pelvis back' },
  'Plank Hold':             { start: 'On hands or forearms, long line', watch: 'Breathe, navel to spine', avoid: 'Don\'t let hips sag or pike' },
  'Diaphragmatic Breathing':{ start: 'On back or seated, hand on belly', watch: 'Belly rises on inhale, chest still', avoid: 'Don\'t force — keep it natural' },
  'Pelvic Floor Activation':{ start: 'On back, knees bent, feet flat', watch: 'Lift up and in — elevator rising', avoid: 'Don\'t squeeze glutes or hold breath' },
}
const DEFAULT_CUE = { start: 'Set up in your starting position', watch: 'Move slowly and with intention', avoid: 'Quality over speed' }

function localizeSessionVoiceCue(cue: VoiceCue, locale: Locale): VoiceCue {
  if (locale === 'en-US') return { ...cue, locale }

  const key = cue.key
  let text = cue.text

  if (key === 'unsupported') text = '这个动作暂时需要手动计数。'
  else if (key === 'upper-body' || key === 'full-body') text = getCue(locale, 'frameBody', 0).text
  else if (key === 'tracking-low-confidence') text = '光线再好一点，或者动作慢一点。'
  else if (key === 'ready') text = '我能看到你的全身了，准备好就开始。'
  else if (key === 'movement-stale') text = '动作再大一点。'
  else if (key === 'return-phase') text = '回到起始位置。'
  else if (key.startsWith('rep-counted-')) text = '很好。'
  else if (key === 'calib-orientation-landscape') text = '请把手机横过来。'
  else if (key === 'calib-orientation-portrait') text = '请把手机竖起来。'
  else if (key === 'calib-no-body') text = getCue(locale, 'calibrate', 1).text
  else if (key === 'calib-upper-body' || key === 'calib-partial' || key === 'calib-key-points') text = getCue(locale, 'frameBody', 1).text
  else if (key === 'calib-low-confidence') text = '改善一下光线，然后保持稳定。'
  else if (key === 'calib-ready') text = '很好，保持一下。'
  else if (key === 'calib-start-anyway') text = '如果你愿意，也可以现在开始。'
  else if (key === 'voice-test') text = '语音教练已开启，我会在训练中提示你。'

  return { ...cue, text, locale }
}

// Exercises whose primary movement is too small / internal for camera-based
// pose tracking to reliably detect a rep cycle (e.g. small internal
// contractions, breath-driven movement). AI form feedback still runs for
// these — only auto rep-counting is held back until it can be done well.
export default function SessionPlayer({ plan, userId, isPro, voiceCoachingEnabled, locale, sessionsThisWeek, bodyPolicy, entitlement, isPersonalizedIntro, reportId, partialSession }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const resumeFrom = partialSession?.lastExerciseIndex ?? 0

  const [phase, setPhase]                 = useState<Phase>('pre-start')
  const [assessmentPromptSkipped, setAssessmentPromptSkipped] = useState(false)
  const [paused, setPaused]               = useState(false)
  const [currentEx, setCurrentEx]         = useState(resumeFrom)
  const [repCount, setRepCount]           = useState(0)
  const [holdElapsed, setHoldElapsed]     = useState(0)
  const [elapsed, setElapsed]             = useState(0)
  const [transitionCount, setTransitionCount] = useState(TRANSITION_COUNTDOWN)
  const [introCount, setIntroCount]           = useState(TRANSITION_COUNTDOWN)
  const [introPaused, setIntroPaused]         = useState(false)
  const [introIsReview, setIntroIsReview]     = useState(false) // true when entered mid-exercise via "Review setup"
  const [skippedExercises, setSkippedExercises]     = useState<number[]>([])
  // On resume, seed with every exercise index before lastExerciseIndex (those were already done)
  const initialCompleted = partialSession
    ? Array.from({ length: partialSession.lastExerciseIndex }, (_, i) => i)
    : []
  const [completedExercises, setCompletedExercises] = useState<number[]>(initialCompleted)
  // Ref always mirrors completedExercises — safe to read in stale closures / timer callbacks
  const completedExRef = useRef<number[]>(initialCompleted)
  const [formScores, setFormScores]       = useState<number[]>([])
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState<string | null>(null)
  const [postSessionFeeling, setPostSessionFeeling] = useState<'better' | 'unchanged' | 'worse' | null>(null)
  const [savingPostSessionFeeling, setSavingPostSessionFeeling] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [showNameOverlay, setShowNameOverlay] = useState(false) // brief name shown when auto-starting

  // ── Camera-first calibration (Pro AI camera) ──────────────────
  // Each exercise begins in `calibrating`: the camera is full-screen and the
  // user gets themselves fully in frame. Once full-body framing is stable for
  // CALIB_HOLD_SECONDS we auto-start the exercise (with a manual "Start now"
  // fallback). Free sessions have no camera, so they start in `exercising`.
  const [activeStage, setActiveStage]   = useState<ActiveStage>(isPro ? 'calibrating' : 'exercising')
  const [calibReady, setCalibReady]     = useState(false)            // full-body + confident right now
  const [calibCountdown, setCalibCountdown] = useState<number | null>(null)
  const [calibBlocker, setCalibBlocker] = useState<CalibrationBlocker | null>(null)
  const [showStartAnyway, setShowStartAnyway] = useState(false)
  const activeStageRef  = useRef<ActiveStage>(isPro ? 'calibrating' : 'exercising')
  const calibTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const calibFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto rep counting — AI rep state machine (Pro · AI camera) ─
  const [aiRepPhase, setAiRepPhase]       = useState<AiRepPhase>('waiting_for_full_body')
  const [framingDetail, setFramingDetail] = useState<FramingDetail>(null)
  const [movementStale, setMovementStale] = useState(false)
  const [repFlash, setRepFlash]           = useState(false)  // brief "Rep counted" toast
  const [qualityCue, setQualityCue]       = useState<string | null>(null)
  const [poseDebugEnabled, setPoseDebugEnabled] = useState(false)
  const [repDiagnostics, setRepDiagnostics] = useState({
    usable: false,
    visible: 0,
    required: 0,
    confidence: 0,
    delta: 0,
  })
  const poseDebugRef = useRef(false)
  const debugLogRef = useRef<DebugLogEntry[]>([])
  const lastDebugPoseLogAtRef = useRef(0)
  const lastBlockerTitleRef = useRef<string | null>(null)
  const aiRepPhaseRef    = useRef<AiRepPhase>('waiting_for_full_body')  // mirrors aiRepPhase — the live cycle tracker
  const framingDetailRef = useRef<FramingDetail>(null)
  const repBaselineRef   = useRef<any[] | null>(null)        // "neutral" pose snapshot for this exercise
  const repCooldownRef   = useRef(0)
  const lastConfidentAtRef = useRef<number | null>(null)
  const hasTrackedRef    = useRef(false)                     // ever achieved confident framing this exercise?
  const engagedSinceRef  = useRef<number | null>(null)       // when we entered waiting_for_engaged_phase (for "movement not detected yet")
  const repFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repCountedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movementStaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceCoachRef    = useRef(createVoiceCoach())
  const voiceEnabledRef  = useRef(voiceCoachingEnabled)
  const speakCue = useCallback((cue: VoiceCue, enabled = voiceEnabledRef.current) => {
    return voiceCoachRef.current.speak(localizeSessionVoiceCue(cue, locale), enabled)
  }, [locale])

  const sessionTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const introTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const overlayTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordId           = useRef<string | null>(partialSession?.id ?? null)
  const autoAdvancedRef    = useRef(false)
  const currentExRef       = useRef<number>(resumeFrom) // mirrors currentEx for stale-closure-safe reads
  const isHoldRef          = useRef(false)              // mirrors isHold — read inside the rep-detector callback
  const repCountRef        = useRef(0)
  const qualityCueRef      = useRef<string | null>(null)
  const targetRepsRef      = useRef(10)                 // mirrors targetReps — read inside the rep-detector callback
  const aiRepSupportedRef  = useRef(true)               // mirrors aiRepSupported — read inside the rep-detector callback
  const startExercisingRef = useRef<() => void>(() => {})
  const advanceToNextRef   = useRef<() => void>(() => {})
  const beginExerciseRef   = useRef<() => void>(() => {})
  const processAutoRepRef  = useRef<(result: { framingStatus: string; landmarks: any[]; bodyConfidence?: number }) => void>(() => {})
  const exercisesRef       = useRef<any[]>([])

  const exercises   = plan.exercises ?? []
  exercisesRef.current = exercises
  const exercise    = exercises[currentEx]?.exercise
  const nextEx      = exercises[currentEx + 1]?.exercise
  const isHold      = exercise?.duration_type === 'hold'
  const targetReps  = exercises[currentEx]?.reps_override ?? exercise?.default_reps ?? 10
  const isComplete  = isHold ? holdElapsed >= targetReps : repCount >= targetReps
  const isFloorExercise = !!(exercise && FLOOR_EXERCISE_NAMES.has(exercise.name))
  const trackingProfile = useMemo(
    () => getExerciseTrackingProfile(exercise?.name, isFloorExercise, exercise?.duration_type),
    [exercise?.name, exercise?.duration_type, isFloorExercise],
  )
  const aiRepSupported = trackingProfile.mode === 'auto'
  // Exercise-specific guide overrides the category default for floor exercises.
  const guide        = (exercise && EXERCISE_CAMERA_GUIDES[exercise.name]) ?? CAMERA_GUIDES[plan.category] ?? CAMERA_GUIDES.full_body
  const cue         = exercise ? (EXERCISE_CUES[exercise.name] ?? DEFAULT_CUE) : DEFAULT_CUE
  const sessionsLeft = Math.max(0, FREE_SESSION_LIMIT - sessionsThisWeek)

  // ── Keep refs in sync with state (so timer callbacks always read fresh values) ──
  useEffect(() => { completedExRef.current = completedExercises }, [completedExercises])
  useEffect(() => { currentExRef.current = currentEx }, [currentEx])
  useEffect(() => { isHoldRef.current = isHold }, [isHold])
  useEffect(() => { repCountRef.current = repCount }, [repCount])
  useEffect(() => { qualityCueRef.current = qualityCue }, [qualityCue])
  useEffect(() => { targetRepsRef.current = targetReps }, [targetReps])
  useEffect(() => { aiRepSupportedRef.current = aiRepSupported }, [aiRepSupported])
  useEffect(() => { activeStageRef.current = activeStage }, [activeStage])

  // ── Reset the AI rep-counter for each new exercise ────────────
  // A "neutral" baseline pose only makes sense for the exercise currently
  // being performed — capture a fresh one each time the exercise changes.
  useEffect(() => {
    repBaselineRef.current = null
    repCooldownRef.current = 0
    lastConfidentAtRef.current = null
    hasTrackedRef.current = false
    engagedSinceRef.current = null
    framingDetailRef.current = null
    setFramingDetail(null)
    setMovementStale(false)
    setRepFlash(false)
    setQualityCue(null)
    qualityCueRef.current = null
    lastBlockerTitleRef.current = null
    // Re-arm calibration for the new exercise — the user may need to reposition.
    setCalibReady(false)
    setCalibCountdown(null)
    setCalibBlocker(null)
    setShowStartAnyway(false)
    if (calibTimerRef.current) { clearInterval(calibTimerRef.current); calibTimerRef.current = null }
    if (calibFallbackTimerRef.current) { clearTimeout(calibFallbackTimerRef.current); calibFallbackTimerRef.current = null }
    if (repFlashTimerRef.current) clearTimeout(repFlashTimerRef.current)
    if (repCountedTimerRef.current) clearTimeout(repCountedTimerRef.current)
    if (movementStaleTimerRef.current) clearTimeout(movementStaleTimerRef.current)
    voiceCoachRef.current.reset()

    const initialPhase: AiRepPhase = trackingProfile.mode === 'manual'
      ? 'unsupported_exercise'
      : 'waiting_for_full_body'
    aiRepPhaseRef.current = initialPhase
    setAiRepPhase(initialPhase)
  }, [currentEx, exercise, trackingProfile.mode])

  // Keep the voice-enabled ref fresh (prop is fixed per session, but this keeps the pattern consistent and SSR-safe)
  useEffect(() => { voiceEnabledRef.current = voiceCoachingEnabled }, [voiceCoachingEnabled])
  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get('poseDebug') === '1'
    poseDebugRef.current = enabled
    setPoseDebugEnabled(enabled)
  }, [])

  // Stop any speech in flight if the user pauses or leaves the active phase
  useEffect(() => {
    if (phase !== 'active' || paused) voiceCoachRef.current.stop()
  }, [phase, paused])

  // ── Session timer ─────────────────────────────────────────────
  // Only counts during the live exercise — calibration setup time isn't workout time.
  useEffect(() => {
    if (phase === 'active' && !paused && activeStage === 'exercising') {
      sessionTimerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current) }
  }, [phase, paused, activeStage])

  // ── Hold countdown ────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active' && isHold && !paused && activeStage === 'exercising') {
      holdTimerRef.current = setInterval(() => {
        setHoldElapsed(h => {
          const next = h + 1
          if (holdTimerRef.current && next >= targetReps) clearInterval(holdTimerRef.current)
          return next
        })
      }, 1000)
    } else {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    }
    return () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current) }
  }, [phase, isHold, paused, targetReps, activeStage])

  // ── Calibration auto-start (Pro AI camera) ────────────────────
  // While calibrating, once full-body framing is stable (calibReady) we run a
  // short visible countdown and then start the exercise. If framing degrades or
  // the user pauses, the countdown cancels and resets — so we never start an
  // exercise we can't actually see.
  useEffect(() => {
    const clear = () => {
      if (calibTimerRef.current) { clearInterval(calibTimerRef.current); calibTimerRef.current = null }
    }
    if (phase !== 'active' || activeStage !== 'calibrating') { clear(); return }

    if (calibReady && !paused) {
      if (!calibTimerRef.current) {
        setCalibCountdown(CALIB_HOLD_SECONDS)
        calibTimerRef.current = setInterval(() => {
          setCalibCountdown(c => {
            if (c === null) return null
            if (c <= 1) { clear(); startExercisingRef.current(); return null }
            return c - 1
          })
        }, 1000)
      }
    } else {
      clear()
      setCalibCountdown(null)
    }
    return clear
  }, [phase, activeStage, calibReady, paused])

  // ── Auto-trigger transition when complete ─────────────────────
  useEffect(() => {
    if (phase === 'active' && isComplete && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true
      const t = setTimeout(() => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current)
        markExerciseComplete(currentEx)   // updates ref synchronously — fixes off-by-one save
        setTransitionCount(TRANSITION_COUNTDOWN)
        setPhase('transition')
      }, 800)
      return () => clearTimeout(t)
    }
  }, [phase, isComplete, currentEx])

  // ── Transition countdown ──────────────────────────────────────
  useEffect(() => {
    if (phase === 'transition') {
      // Spoken heads-up so users 6–8 feet from the phone know what's next without
      // looking at the screen. Announce the upcoming exercise BY NAME (the start
      // cue a few seconds later carries the rep/hold target). Per-exercise key so
      // each transition gets its own cooldown.
      const upcomingIdx = currentExRef.current + 1
      const upcoming    = exercisesRef.current[upcomingIdx]?.exercise
      if (upcoming) {
        speakCue(
          {
            key: `transition-${upcomingIdx}`,
            text: getCue(locale, 'transition', upcomingIdx, {
              exerciseName: upcoming.name,
              seconds: TRANSITION_COUNTDOWN,
            }).text,
            cooldownMs: 4_000,
          },
          voiceEnabledRef.current
        )
      } else {
        speakCue(
          { key: 'transition-finish', text: getCue(locale, 'finish', currentExRef.current).text, cooldownMs: 4_000 },
          voiceEnabledRef.current
        )
      }
      transitionTimerRef.current = setInterval(() => {
        setTransitionCount(c => {
          if (c <= 1) {
            if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
            advanceToNextRef.current()
            return 0
          }
          return c - 1
        })
      }, 1000)
    } else {
      if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
    }
    return () => { if (transitionTimerRef.current) clearInterval(transitionTimerRef.current) }
  }, [phase, locale, speakCue])

  // ── Name overlay auto-hide ────────────────────────────────────
  useEffect(() => {
    if (showNameOverlay) {
      overlayTimerRef.current = setTimeout(() => setShowNameOverlay(false), 3000)
    }
    return () => { if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current) }
  }, [showNameOverlay])

  // ── Intro auto-countdown ──────────────────────────────────────
  useEffect(() => {
    if (phase === 'exercise-intro' && !introPaused) {
      setIntroCount(TRANSITION_COUNTDOWN)
      introTimerRef.current = setInterval(() => {
        setIntroCount(c => {
          if (c <= 1) {
            if (introTimerRef.current) clearInterval(introTimerRef.current)
            beginExerciseRef.current()
            return 0
          }
          return c - 1
        })
      }, 1000)
    } else {
      if (introTimerRef.current) clearInterval(introTimerRef.current)
    }
    return () => { if (introTimerRef.current) clearInterval(introTimerRef.current) }
  }, [phase, introPaused])

  // ── Session management ────────────────────────────────────────
  async function startSession() {
    if (bodyPolicy === 'block_safety') return
    setSaveError(null)
    if (partialSession) {
      // Resume — record already exists
      setIntroPaused(false)
      setPhase('exercise-intro')
      return
    }
    const { data, error } = await supabase
      .from('session_records')
      .insert({
        user_id: userId,
        session_plan_id: plan.id,
        report_id: reportId,
        is_personalized_intro: isPersonalizedIntro,
        started_at: new Date().toISOString(),
        total_exercises: exercises.length,
        last_exercise_index: 0,
      })
      .select('id').single()
    if (error || !data) {
      setSaveError(error?.message ?? 'Unable to create a session record.')
      return
    }
    recordId.current = data.id
    if (isPersonalizedIntro) {
      trackAssessmentEvent('first_session', { step_name: 'first_session', outcome: 'started' })
    }
    setIntroPaused(false)
    setIntroIsReview(false)
    setPhase('exercise-intro')
  }

  /**
   * Record an exercise as completed. Updates the ref SYNCHRONOUSLY (so any code
   * that reads `completedExRef.current` right after — e.g. saving progress in
   * advanceToNext/endSession — sees the fresh count) as well as React state for
   * the UI. De-dupes so the same index can never be counted twice. Skipped
   * exercises are intentionally NOT routed through here, so they don't inflate
   * the completed count.
   */
  function markExerciseComplete(index: number): number[] {
    const next = completedExRef.current.includes(index)
      ? completedExRef.current
      : [...completedExRef.current, index]
    completedExRef.current = next   // synchronous — safe for immediate reads
    setCompletedExercises(next)     // keep React state (and the UI) in sync
    return next
  }

  /**
   * Shared "starting this exercise" voice cue — used by BOTH the first/manual
   * start (beginExercise) and every auto-advance/skip start, so exercises 2+
   * announce their name and rep/hold target just like the first one. Respects
   * the user's voice-coaching setting and per-exercise cooldown.
   */
  function announceExerciseStart(index: number) {
    const se = exercises[index]
    const exName = se?.exercise?.name ?? ''
    if (!exName) return
    const tReps    = se.reps_override ?? se.exercise?.default_reps ?? 0
    const holdType = se.exercise?.duration_type === 'hold'
    const countText = locale === 'zh-CN'
      ? (holdType ? `${tReps} 秒保持` : `${tReps} 次`)
      : (holdType ? `${tReps} second hold` : `${tReps} reps`)
    // Small delay so the phase has settled before speaking.
    setTimeout(() => {
      speakCue(
        {
          key: `exercise-start-${index}`,
          text: getCue(locale, 'exerciseStart', index, { exerciseName: exName, target: countText }).text,
          cooldownMs: 3_000,
        },
        voiceEnabledRef.current
      )
    }, 400)
  }

  /**
   * Prime the active sub-stage when entering an exercise. Pro AI sessions begin
   * in `calibrating` (camera-first "get in frame" gate, auto-start handled by the
   * calibration effect); free sessions go straight to `exercising`. Resets the
   * calibration countdown so each exercise starts fresh.
   */
  function primeActiveStage() {
    setCalibReady(false)
    setCalibCountdown(null)
    setCalibBlocker(null)
    setShowStartAnyway(false)
    if (calibTimerRef.current) { clearInterval(calibTimerRef.current); calibTimerRef.current = null }
    if (calibFallbackTimerRef.current) { clearTimeout(calibFallbackTimerRef.current); calibFallbackTimerRef.current = null }
    const stage: ActiveStage = isPro ? 'calibrating' : 'exercising'
    activeStageRef.current = stage
    setActiveStage(stage)
    if (stage === 'calibrating') {
      speakCue(
        { key: 'calibrate', text: getCue(locale, 'calibrate', currentExRef.current).text, cooldownMs: 8_000 },
        voiceEnabledRef.current
      )
    }
  }

  /**
   * Leave calibration and start the live, counted exercise. Called when framing
   * has been stable long enough, or when the user taps "Start now". For free
   * sessions this is effectively the start of the exercise too.
   */
  function startExercising() {
    if (calibTimerRef.current) { clearInterval(calibTimerRef.current); calibTimerRef.current = null }
    if (calibFallbackTimerRef.current) { clearTimeout(calibFallbackTimerRef.current); calibFallbackTimerRef.current = null }
    setCalibCountdown(null)
    setShowStartAnyway(false)
    setCalibBlocker(null)
    activeStageRef.current = 'exercising'
    setActiveStage('exercising')
    autoAdvancedRef.current = false
    repCountRef.current = 0
    setRepCount(0)
    setHoldElapsed(0)
    setPaused(false)
    voiceCoachRef.current.unlock()
    announceExerciseStart(currentExRef.current)
  }

  function beginExercise() {
    autoAdvancedRef.current = false
    setHoldElapsed(0)
    repCountRef.current = 0
    setRepCount(0)
    setPaused(false)   // always unpause — handles "review setup" path where paused was set true

    // This is a direct user gesture — use it to unlock AudioContext + speech synthesis
    // so subsequent voice cues fire immediately rather than being blocked by autoplay policy.
    voiceCoachRef.current.unlock()

    primeActiveStage()
    // Pro starts in calibration (announce happens when the exercise actually
    // starts via startExercising); free sessions start the exercise immediately.
    if (!isPro) announceExerciseStart(currentExRef.current)

    setPhase('active')
  }

  /** Auto-advance after transition — skips exercise-intro for exercises 2+ */
  function advanceToNext() {
    // Always read from refs — this function may be called from stale timer closures
    const curIdx  = currentExRef.current
    const doneCnt = completedExRef.current.length

    if (curIdx < exercises.length - 1) {
      const nextIdx = curIdx + 1
      setCurrentEx(nextIdx)
      currentExRef.current = nextIdx   // keep ref synchronous for the next cue/save
      repCountRef.current = 0
      setRepCount(0)
      setHoldElapsed(0)
      autoAdvancedRef.current = false

      // Auto-start directly — no mandatory intro screen. Pro recalibrates (the
      // user may have repositioned between exercises); free starts immediately.
      setShowNameOverlay(true)
      primeActiveStage()
      if (!isPro) announceExerciseStart(nextIdx)
      setPhase('active')

      // Save progress: last_exercise_index = next exercise to do (= resume point)
      if (recordId.current) {
        supabase.from('session_records').update({
          last_exercise_index: nextIdx,       // "resume from" this index next time
          exercises_completed: doneCnt,        // ref has the fresh count (no +1 needed)
          duration_seconds: elapsed,
        }).eq('id', recordId.current).then(result => {
          if (result.error) setSaveError(result.error.message)
        })
      }
    } else {
      endSession()
    }
  }

  function handleSkipRequest() {
    // If the exercise is already complete, "skip" just means advance — record the
    // completion synchronously first so the saved count isn't off by one.
    if (isComplete) { markExerciseComplete(currentExRef.current); advanceToNext(); return }
    setPaused(true)
    setPhase('skip-confirm')
  }

  function confirmSkip() {
    const curIdx = currentExRef.current
    setSkippedExercises(prev => [...prev, curIdx])
    if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
    if (curIdx < exercises.length - 1) {
      const nextIdx = curIdx + 1
      setCurrentEx(nextIdx)
      currentExRef.current = nextIdx   // keep ref synchronous for the next cue
      repCountRef.current = 0; setRepCount(0); setHoldElapsed(0); autoAdvancedRef.current = false
      setShowNameOverlay(true)
      setPaused(false)
      primeActiveStage()
      if (!isPro) announceExerciseStart(nextIdx)
      setPhase('active')
    } else {
      endSession()
    }
  }

  function handleExitRequest() {
    setPaused(true)
    setPhase('exit-confirm')
  }

  async function saveAndExit() {
    clearAllTimers()
    setSaveError(null)
    try {
      if (recordId.current) {
        const avgScore  = calcAvgScore()
        const doneCnt   = completedExRef.current.length
        // last_exercise_index = "resume from this index": always equal to # of completed exercises,
        // since exercises are done in order and we seed from this value on resume.
        const resumeIdx = Math.min(doneCnt, exercises.length - 1)
        const result = await supabase.from('session_records').update({
          completed_at: new Date().toISOString(),
          duration_seconds: elapsed,
          form_score: avgScore,
          exercises_completed: doneCnt,
          last_exercise_index: resumeIdx,
          total_exercises: exercises.length,
          is_partial: true,
          skipped_exercises: skippedExercises.length,
          ai_feedback: doneCnt > 0 ? generateFeedback(avgScore) : null,
        }).eq('id', recordId.current)
        assertSupabaseSuccess(result, 'Save session progress')
      }
      router.push('/home')
    } catch (err) {
      setPaused(true)
      setPhase('exit-confirm')
      setSaveError(err instanceof Error ? err.message : 'Unable to save session progress.')
    }
  }

  function discardAndExit() {
    clearAllTimers()
    // Delete the incomplete record if nothing was done yet
    if (recordId.current && completedExRef.current.length === 0 && elapsed < 30) {
      supabase.from('session_records').delete().eq('id', recordId.current).then(() => {})
    }
    router.push('/home')
  }

  async function endSession() {
    clearAllTimers()
    setSaving(true)
    setSaveError(null)
    const avgScore   = calcAvgScore()
    // Use refs — endSession may be called from a stale closure inside advanceToNext
    const doneCnt    = completedExRef.current.length
    const allCompleted = doneCnt >= exercises.length - skippedExercises.length
    const localSummary = fallbackSummary(buildSummaryInput({
      locale,
      formScore: avgScore,
      durationSeconds: elapsed,
      exercisesCompleted: doneCnt,
      skippedExercises: skippedExercises.length,
    }))
    try {
      if (recordId.current) {
        const result = await supabase.from('session_records').update({
          completed_at: new Date().toISOString(),
          duration_seconds: elapsed,
          form_score: avgScore,
          exercises_completed: doneCnt,
          last_exercise_index: exercises.length - 1,
          total_exercises: exercises.length,
          is_partial: !allCompleted,
          skipped_exercises: skippedExercises.length,
          ai_feedback: `${localSummary.headline}\n\n${localSummary.body}`,
        }).eq('id', recordId.current)
        assertSupabaseSuccess(result, 'Complete session')
        setSessionSummary(localSummary)
        void requestSessionSummary(recordId.current).then(result => {
          if (result) setSessionSummary(result.summary)
        })
      }
      setPhase('finished')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save completed session.')
      setPaused(true)
      setPhase('exit-confirm')
    } finally {
      setSaving(false)
    }
  }

  async function savePostSessionFeeling(feeling: 'better' | 'unchanged' | 'worse') {
    if (!recordId.current || savingPostSessionFeeling) return
    setSavingPostSessionFeeling(true)
    setSaveError(null)
    try {
      const result = await supabase.from('session_records')
        .update({ post_session_response: feeling })
        .eq('id', recordId.current)
        .eq('user_id', userId)
      assertSupabaseSuccess(result, 'Save post-session body feeling')
      setPostSessionFeeling(feeling)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save how your body feels.')
    } finally {
      setSavingPostSessionFeeling(false)
    }
  }

  function clearAllTimers() {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
    if (introTimerRef.current) clearInterval(introTimerRef.current)
    if (calibTimerRef.current) clearInterval(calibTimerRef.current)
    if (calibFallbackTimerRef.current) clearTimeout(calibFallbackTimerRef.current)
    if (repFlashTimerRef.current) clearTimeout(repFlashTimerRef.current)
    if (repCountedTimerRef.current) clearTimeout(repCountedTimerRef.current)
    if (movementStaleTimerRef.current) clearTimeout(movementStaleTimerRef.current)
  }

  const recordDebugEvent = useCallback((eventType: DebugEventType, data: Partial<DebugLogEntry> = {}) => {
    const currentExerciseName = exercisesRef.current[currentExRef.current]?.exercise?.name ?? exercise?.name ?? ''
    const entry: DebugLogEntry = {
      exerciseName: data.exerciseName ?? currentExerciseName,
      timestamp: data.timestamp ?? new Date().toISOString(),
      aiRepPhase: data.aiRepPhase ?? aiRepPhaseRef.current,
      framingStatus: data.framingStatus ?? framingDetailRef.current ?? 'unknown',
      bodyConfidence: data.bodyConfidence ?? repDiagnostics.confidence,
      visibleLandmarks: data.visibleLandmarks ?? repDiagnostics.visible,
      requiredLandmarks: data.requiredLandmarks ?? repDiagnostics.required,
      delta: data.delta ?? repDiagnostics.delta,
      engageThreshold: data.engageThreshold ?? trackingProfile.engageThreshold,
      returnThreshold: data.returnThreshold ?? trackingProfile.returnThreshold,
      repCount: data.repCount ?? repCountRef.current,
      qualityCue: data.qualityCue ?? qualityCueRef.current,
      eventType,
    }
    debugLogRef.current.push(entry)
    if (debugLogRef.current.length > DEBUG_LOG_LIMIT) {
      debugLogRef.current.splice(0, debugLogRef.current.length - DEBUG_LOG_LIMIT)
    }
  }, [exercise?.name, repDiagnostics, trackingProfile.engageThreshold, trackingProfile.returnThreshold])

  function downloadDebugLog() {
    const payload = JSON.stringify(debugLogRef.current, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (exercise?.name ?? 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    link.href = url
    link.download = `forma-debug-${safeName || 'session'}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  /** Briefly flash the "Rep counted" toast — always shown, regardless of whether voice announces it. */
  function flashRep() {
    setRepFlash(true)
    if (repFlashTimerRef.current) clearTimeout(repFlashTimerRef.current)
    repFlashTimerRef.current = setTimeout(() => setRepFlash(false), REP_COUNTED_DISPLAY_MS)
  }

  /** Move the AI rep state machine to a new phase, mirror it in the ref, and speak its cue (if any). */
  function setAiPhase(phase: AiRepPhase, detail: FramingDetail = framingDetailRef.current, stale = movementStale) {
    aiRepPhaseRef.current = phase
    setAiRepPhase(phase)
    recordDebugEvent('phase_change', { aiRepPhase: phase, framingStatus: detail ?? 'tracked' })
    const status = describeAiRepStatus(phase, detail, stale)
    if (status.voice) speakCue(status.voice, voiceEnabledRef.current)
  }

  /**
   * Generic AI rep detector — Pro users only, rep-based (non-hold, AI-supported)
   * exercises only. Implements the named state machine from the spec:
   *
   *   waiting_for_full_body → ready_for_baseline → waiting_for_engaged_phase
   *     → waiting_for_return_phase → rep_counted → (back to waiting_for_engaged_phase)
   *
   * with `tracking_lost` as a side-branch once we've tracked confidently before,
   * and `movementStale` as an overlay on waiting_for_engaged_phase. Each phase
   * transition drives the on-screen chip/message AND a throttled voice cue via
   * `describeAiRepStatus` — a single source of truth — so visuals and speech can
   * never drift out of sync. Manual +/- correction always remains available as a
   * fallback (see UI below) regardless of what this detector decides.
   */
  function processAutoRep(result: { framingStatus: string; landmarks: any[]; bodyConfidence?: number }) {
    const lm = result.landmarks ?? []
    const confidence = result.bodyConfidence ?? 0
    const trackedVisible = hasTrackingCoverage(lm, trackingProfile.landmarks, trackingProfile)
    const visibleCount = trackingProfile.landmarks.filter(
      index => (lm[index]?.visibility ?? 0) >= trackingProfile.minVisibility,
    ).length
    const requiredCount = Math.min(
      trackingProfile.landmarks.length,
      Math.max(
        trackingProfile.minVisibleLandmarks,
        Math.ceil(trackingProfile.landmarks.length * trackingProfile.minVisibleRatio),
      ),
    )
    const confident = result.framingStatus === 'full-body'
      && lm.length >= 29
      && confidence >= trackingProfile.confidenceThreshold
      && trackedVisible
    const now = Date.now()

    if (!confident) {
      if (now - lastDebugPoseLogAtRef.current > DEBUG_POSE_LOG_INTERVAL_MS) {
        lastDebugPoseLogAtRef.current = now
        recordDebugEvent('pose_update', {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta: 0,
        })
      }
      if (poseDebugRef.current) {
        setRepDiagnostics({ usable: false, visible: visibleCount, required: requiredCount, confidence, delta: 0 })
      }
      setQualityCue(null)
      // Classify *why* we can't track confidently — drives both the chip copy and the voice cue.
      let detail: FramingDetail = 'low-confidence'
      if (result.framingStatus === 'no-body' || lm.length < 29) detail = 'no-body'
      else if (result.framingStatus === 'upper-body') detail = 'upper-body'

      if (isWithinTrackingGrace(lastConfidentAtRef.current, now, trackingProfile.trackingGraceMs)) return

      const previousDetail = framingDetailRef.current
      framingDetailRef.current = detail
      setFramingDetail(detail)
      repBaselineRef.current = null
      lastConfidentAtRef.current = null
      engagedSinceRef.current = null
      if (movementStale) setMovementStale(false)
      if (movementStaleTimerRef.current) { clearTimeout(movementStaleTimerRef.current); movementStaleTimerRef.current = null }

      // Once we've tracked confidently this exercise, losing it is "tracking lost"
      // rather than "never found you" — the copy and voice differ accordingly.
      const nextPhase: AiRepPhase = hasTrackedRef.current ? 'tracking_lost' : 'waiting_for_full_body'
      if (aiRepPhaseRef.current !== nextPhase || previousDetail !== detail) {
        setAiPhase(nextPhase, detail, false)
      }
      return
    }

    // Confident frame — clear any "can't see you" framing detail.
    hasTrackedRef.current = true
    lastConfidentAtRef.current = now
    if (framingDetailRef.current !== null) {
      framingDetailRef.current = null
      setFramingDetail(null)
    }
    const nextQualityCue = detectQualityCue(exercisesRef.current[currentExRef.current]?.exercise?.name, lm)
    if (qualityCueRef.current !== nextQualityCue) {
      qualityCueRef.current = nextQualityCue
      setQualityCue(nextQualityCue)
      if (nextQualityCue) {
        recordDebugEvent('quality_cue', {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          qualityCue: nextQualityCue,
        })
      }
    }

    // Hold the "Rep counted ✓" confirmation on screen for a beat before resuming detection.
    if (aiRepPhaseRef.current === 'rep_counted') return

    if (!repBaselineRef.current) {
      if (now - lastDebugPoseLogAtRef.current > DEBUG_POSE_LOG_INTERVAL_MS) {
        lastDebugPoseLogAtRef.current = now
        recordDebugEvent('pose_update', {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta: 0,
        })
      }
      // First confident frame (or first since losing/regaining tracking) — anchor "neutral".
      repBaselineRef.current = lm
      if (aiRepPhaseRef.current !== 'ready_for_baseline') setAiPhase('ready_for_baseline', null, false)
      return
    }

    if (aiRepPhaseRef.current === 'ready_for_baseline') {
      setAiPhase('waiting_for_engaged_phase', null, false)
      engagedSinceRef.current = now
      if (movementStale) setMovementStale(false)
    }

    const delta = normalizedPoseDistance(
      lm,
      repBaselineRef.current,
      trackingProfile.landmarks,
      trackingProfile.minVisibility,
    )
    if (poseDebugRef.current) {
      setRepDiagnostics({ usable: true, visible: visibleCount, required: requiredCount, confidence, delta })
    }
    if (now - lastDebugPoseLogAtRef.current > DEBUG_POSE_LOG_INTERVAL_MS) {
      lastDebugPoseLogAtRef.current = now
      recordDebugEvent('pose_update', {
        framingStatus: result.framingStatus,
        bodyConfidence: confidence,
        visibleLandmarks: visibleCount,
        requiredLandmarks: requiredCount,
        delta,
      })
    }

    if (aiRepPhaseRef.current === 'waiting_for_engaged_phase') {
      if (delta > trackingProfile.engageThreshold) {
        if (movementStale) setMovementStale(false)
        if (movementStaleTimerRef.current) { clearTimeout(movementStaleTimerRef.current); movementStaleTimerRef.current = null }
        setAiPhase('waiting_for_return_phase', null, false)
      } else if (engagedSinceRef.current && now - engagedSinceRef.current > MOVEMENT_TIMEOUT_MS && !movementStale) {
        // No movement for a while — gently nudge rather than sit silently in "AI counting reps".
        setMovementStale(true)
        const status = describeAiRepStatus('waiting_for_engaged_phase', null, true)
        if (status.voice) speakCue(status.voice, voiceEnabledRef.current)
      }
      return
    }

    if (aiRepPhaseRef.current === 'waiting_for_return_phase') {
      if (delta < trackingProfile.returnThreshold && now - repCooldownRef.current > REP_COOLDOWN_MS) {
        repCooldownRef.current = now
        repBaselineRef.current = lm   // re-anchor neutral to the current "returned" pose (corrects for drift)
        const nextRep = Math.min(targetRepsRef.current, repCountRef.current + 1)
        repCountRef.current = nextRep
        setRepCount(nextRep)
        recordDebugEvent('count', {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta,
          repCount: nextRep,
        })
        flashRep()
        engagedSinceRef.current = now
        if (movementStale) setMovementStale(false)
        setAiPhase('rep_counted', null, false)

        if (repCountedTimerRef.current) clearTimeout(repCountedTimerRef.current)
        repCountedTimerRef.current = setTimeout(() => {
          if (aiRepPhaseRef.current === 'rep_counted') setAiPhase('waiting_for_engaged_phase', null, false)
        }, REP_COUNTED_DISPLAY_MS)
      }
      return
    }
  }

  startExercisingRef.current = startExercising
  advanceToNextRef.current = advanceToNext
  beginExerciseRef.current = beginExercise
  processAutoRepRef.current = processAutoRep

  function calcAvgScore() {
    return formScores.length ? Math.round(formScores.reduce((a,b) => a+b,0)/formScores.length) : 0
  }

  function handleRep() {
    if (!isHold && repCountRef.current < targetReps) {
      const nextRep = Math.min(targetReps, repCountRef.current + 1)
      repCountRef.current = nextRep
      setRepCount(nextRep)
      recordDebugEvent('count', { repCount: nextRep })
    }
  }

  /** +/- correction control — available to everyone as a fallback/fix for AI (mis)counts. */
  function adjustRep(delta: number) {
    if (isHold) return
    const nextRep = Math.max(0, Math.min(targetReps, repCountRef.current + delta))
    repCountRef.current = nextRep
    setRepCount(nextRep)
    recordDebugEvent('count', { repCount: nextRep })
  }

  // Stable identity across renders — PoseCamera mirrors this in a ref, so
  // passing a fresh function here on every render (timer ticks, rep counts,
  // form score updates, etc.) can never trigger a camera re-init/flicker.
  // `isPro` is a prop fixed for the lifetime of a session, so closing over it
  // here is safe — it's listed as a dep purely for clarity/lint correctness.
  const handlePoseResult = useCallback((result: {
    formScore: number | null
    framingStatus: string
    landmarks: any[]
    bodyConfidence?: number
    diagnostics?: { orientation: 'portrait' | 'landscape' }
  }) => {
    // Only aggregate real scores. null = "not scored for this view" (e.g. mat
    // poses) — it must not drag the session average down toward zero.
    if (result.formScore !== null && result.formScore > 0) {
      setFormScores(prev => [...prev.slice(-20), result.formScore as number])
    }
    // Camera-first calibration gate: while calibrating, we only care whether the
    // full body is confidently in frame — that's what drives the auto-start
    // countdown. We don't count reps until the exercise has actually started.
    if (isPro && activeStageRef.current === 'calibrating') {
      const lm = result.landmarks ?? []
      const confidence = result.bodyConfidence ?? 0
      const visibleCount = trackingProfile.landmarks.filter(
        index => (lm[index]?.visibility ?? 0) >= trackingProfile.minVisibility,
      ).length
      const requiredCount = requiredVisibleLandmarks(trackingProfile)
      const orientationReady = trackingProfile.cameraOrientation === 'either'
        || result.diagnostics?.orientation === trackingProfile.cameraOrientation
      const landmarksReady = hasTrackingCoverage(lm, trackingProfile.landmarks, trackingProfile)
      const ready = orientationReady
        && result.framingStatus === 'full-body'
        && confidence >= trackingProfile.confidenceThreshold
        && landmarksReady
      const blocker = describeCalibrationBlocker({
        orientationReady,
        expectedOrientation: trackingProfile.cameraOrientation,
        actualOrientation: result.diagnostics?.orientation,
        framingStatus: result.framingStatus,
        confidence,
        confidenceThreshold: trackingProfile.confidenceThreshold,
        visibleCount,
        requiredCount,
        landmarksReady,
      })
      setCalibBlocker(blocker)
      if (lastBlockerTitleRef.current !== blocker.title) {
        lastBlockerTitleRef.current = blocker.title
        recordDebugEvent('blocker', {
          framingStatus: result.framingStatus,
          bodyConfidence: confidence,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta: 0,
        })
      }
      speakCue(blocker.voice, voiceEnabledRef.current)
      setCalibReady(prev => (prev === ready ? prev : ready))
      if (ready) {
        if (calibFallbackTimerRef.current) {
          clearTimeout(calibFallbackTimerRef.current)
          calibFallbackTimerRef.current = null
        }
        setShowStartAnyway(false)
      } else if (!calibFallbackTimerRef.current) {
        calibFallbackTimerRef.current = setTimeout(() => {
          setShowStartAnyway(true)
          speakCue(
            { key: 'calib-start-anyway', text: 'You can start anyway if you want.', cooldownMs: 30_000 },
            voiceEnabledRef.current,
          )
        }, START_ANYWAY_DELAY_MS)
      }
      return
    }
    // Auto rep counting is a Pro AI-camera feature. It only runs once the
    // exercise is live (post-calibration), for rep-based exercises (holds are
    // timed, not counted) whose movement is visible enough for pose tracking to
    // reliably detect a rep cycle.
    if (isPro && !isHoldRef.current && aiRepSupportedRef.current && activeStageRef.current === 'exercising') {
      processAutoRepRef.current(result)
    } else if (isPro && activeStageRef.current === 'exercising') {
      const lm = result.landmarks ?? []
      const visibleCount = trackingProfile.landmarks.filter(
        index => (lm[index]?.visibility ?? 0) >= trackingProfile.minVisibility,
      ).length
      const requiredCount = requiredVisibleLandmarks(trackingProfile)
      const now = Date.now()
      if (now - lastDebugPoseLogAtRef.current > DEBUG_POSE_LOG_INTERVAL_MS) {
        lastDebugPoseLogAtRef.current = now
        recordDebugEvent('pose_update', {
          framingStatus: result.framingStatus,
          bodyConfidence: result.bodyConfidence ?? 0,
          visibleLandmarks: visibleCount,
          requiredLandmarks: requiredCount,
          delta: 0,
        })
      }
    }
  }, [isPro, recordDebugEvent, speakCue, trackingProfile])

  const avgScore = calcAvgScore()
  // Single source of truth for the AI rep-counting chip/message/voice — keeps
  // on-screen copy and spoken prompts perfectly in sync with the state machine.
  const aiStatus = describeAiRepStatus(aiRepPhase, framingDetail, movementStale)
  const cycleStage = repCycleStage(aiRepPhase)
  const AI_STATUS_TONE_CLASSES: Record<AiRepStatus['tone'], string> = {
    tracking:  'bg-sage/20 text-sage-light',
    success:   'bg-sage/25 text-sage-light',
    attention: 'bg-amber-400/15 text-amber-200',
    muted:     'bg-white/8 text-white/45',
  }

  // ══════════════════════════════════════════════════════════════
  // SCREENS
  // ══════════════════════════════════════════════════════════════

  if (phase === 'pre-start' && bodyPolicy === 'block_safety') {
    return (
      <div className="flex min-h-dvh flex-col bg-charcoal text-white">
        <div className="flex items-center gap-4 px-5 pb-4 pt-14">
          <button onClick={() => router.back()} aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <BackArrow />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-light">Safety pause</p>
        </div>
        <div className="flex flex-1 flex-col justify-center px-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose/20 text-rose-light">
            <ShieldAlert size={26} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-3xl">Movement is paused.</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            Your latest body check-in includes a stop signal. Forma will not start a movement session right now.
          </p>
        </div>
        <div className="px-5 pb-10">
          <Link href="/home" className="flex w-full items-center justify-center rounded-full bg-white py-4 text-base font-semibold text-charcoal">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'pre-start' && bodyPolicy === 'prompt_assessment' && !assessmentPromptSkipped) {
    return (
      <div className="flex min-h-dvh flex-col bg-charcoal text-white">
        <div className="flex items-center gap-4 px-5 pb-4 pt-14">
          <button onClick={() => router.back()} aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <BackArrow />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-light">Before you begin</p>
        </div>
        <div className="flex flex-1 flex-col justify-center px-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/20 text-sage-light">
            <ScanLine size={26} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-3xl">Give Forma a clearer starting point.</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            A two-minute, no-mat assessment helps tailor guidance to your current mobility and movement control.
          </p>
        </div>
        <div className="grid gap-3 px-5 pb-10">
          <Link href="/assessment" className="flex w-full items-center justify-center rounded-full bg-sage py-4 text-base font-semibold text-white">
            Assess first
          </Link>
          <button type="button" onClick={() => setAssessmentPromptSkipped(true)}
            className="w-full rounded-full border border-white/15 bg-white/10 py-3.5 text-sm font-medium text-white/80">
            Continue without assessment
          </button>
          <p className="text-center text-xs leading-relaxed text-white/40">You can build your baseline later from Home.</p>
        </div>
      </div>
    )
  }

  // ── PRE-START ─────────────────────────────────────────────────
  if (phase === 'pre-start') {
    const isResume = !!partialSession
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col">
        <div className="flex items-center gap-4 px-5 pt-14 pb-4">
          <button onClick={() => router.back()} aria-label="Go back"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <BackArrow />
          </button>
          <div className="flex-1">
            <h2 className="font-serif text-lg text-white">{plan.name}</h2>
            <p className="text-white/50 text-xs mt-0.5">{exercises.length} exercises · {plan.duration_minutes} min</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 text-center">
          <div className="text-5xl">{plan.thumbnail_emoji}</div>
          <div>
            <h1 className="font-serif text-2xl text-white mb-2">{plan.name}</h1>
            <p className="text-white/60 text-sm leading-relaxed">{plan.description}</p>
          </div>

          {isResume && (
            <div className="bg-sage/20 border border-sage/30 rounded-2xl p-4 w-full max-w-xs text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sage-light text-sm font-semibold">Session in progress</p>
                <span className="text-white/40 text-[10px]">
                  {formatSavedAgo(partialSession!.savedAt)}
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="h-1 bg-white/15 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-sage-light rounded-full"
                  style={{ width: `${Math.round((partialSession!.exercisesCompleted / exercises.length) * 100)}%` }}/>
              </div>
              <p className="text-white/70 text-xs">
                Resume from exercise {partialSession!.lastExerciseIndex + 1}
              </p>
              <p className="text-white/45 text-xs mt-0.5">
                {partialSession!.exercisesCompleted} completed
                {' · '}
                {exercises.length - partialSession!.exercisesCompleted} remaining
              </p>
            </div>
          )}

          {!isPro && !isResume && !isPersonalizedIntro && (
            <div className={`rounded-2xl px-4 py-3 text-xs w-full max-w-xs
              ${sessionsLeft === 0 ? 'bg-amber-500/15 border border-amber-400/30' : 'bg-white/8'}`}>
              <p className={`font-semibold mb-0.5 ${sessionsLeft === 0 ? 'text-amber-300' : 'text-white/70'}`}>
                {sessionsLeft === 0
                  ? '⚠ No free sessions left this week'
                  : `🌿 ${sessionsLeft} of ${FREE_SESSION_LIMIT} free sessions left · resets Monday`}
              </p>
              <div className="text-white/40">
                Upgrade for unlimited sessions, AI form analysis + progress insights.{' '}
                <UpgradeButton plan="monthly" className="text-sage-light underline font-medium">
                  See Pro →
                </UpgradeButton>
              </div>
            </div>
          )}

          {isPro && (
            <div className="flex items-center gap-2 bg-sage/20 rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-sage-light animate-pulse"/>
              <span className="text-sage-light text-xs font-medium">AI camera will monitor your form</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-10 flex flex-col gap-3">
          {isPro && !isResume && (
            <button onClick={() => setPhase('camera-guide')}
              className="w-full bg-white/10 text-white/80 rounded-full py-3.5 text-sm font-medium
                         border border-white/15 active:bg-white/20 transition-colors">
              📷 How to set up my camera
            </button>
          )}
          {sessionsLeft === 0 && !isPro && !isPersonalizedIntro ? (
            <UpgradeButton plan="monthly"
              className="w-full bg-sage text-white rounded-full py-4 font-semibold text-base text-center
                         shadow-[0_4px_16px_rgba(122,158,142,.4)] block">
              Upgrade to continue →
            </UpgradeButton>
          ) : (
            <button onClick={startSession}
              className="w-full bg-sage text-white rounded-full py-4 font-semibold text-base
                         shadow-[0_4px_16px_rgba(122,158,142,.4)] active:scale-[.97] transition-transform">
              {isResume ? `Resume from exercise ${partialSession!.lastExerciseIndex + 1}` : 'Begin session'}
            </button>
          )}
          {saveError && (
            <div className="rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-sm text-rose-dark">
              {saveError}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── CAMERA GUIDE ─────────────────────────────────────────────
  if (phase === 'camera-guide') {
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col">
        <div className="flex items-center gap-3 px-5 pt-14 pb-4">
          <button onClick={() => setPhase('pre-start')} aria-label="Back"
            className="flex items-center gap-2 text-white/70 active:text-white transition-colors">
            <BackArrow /><span className="text-sm font-medium">Back</span>
          </button>
          <h2 className="font-serif text-lg text-white ml-2">Camera setup</h2>
        </div>
        <div className="flex-1 px-5 pt-2 pb-10 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-[#1E1E1E] rounded-2xl p-6 flex flex-col items-center">
            <CameraSetupDiagram category={plan.category} />
          </div>
          <div className="bg-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4">
            <SetupRow icon="📍" label="Position" value={guide.position} />
            <div className="h-px bg-white/8"/>
            <SetupRow icon="📏" label="Distance" value={guide.distance} />
            <div className="h-px bg-white/8"/>
            <SetupRow icon="📐" label="Camera height" value={guide.angle} />
          </div>
          <div className="bg-sage/15 border border-sage/30 rounded-2xl p-4 flex gap-3">
            <span className="text-xl">💡</span>
            <p className="text-white/80 text-sm leading-relaxed">{guide.tip}</p>
          </div>

          {/* Floor exercise reminder — shown when the current (or first) exercise is a mat exercise */}
          {isFloorExercise && (
            <div className="bg-amber-400/10 border border-amber-400/25 rounded-2xl p-4 flex gap-3">
              <span className="text-xl">🏔️</span>
              <p className="text-white/75 text-sm leading-relaxed">
                <span className="font-semibold text-white/90">Floor exercise ahead.</span>{' '}
                Phone in landscape mode, propped at mat level 8–10 ft to the side. Your whole body — head to feet — must stay in frame.
              </p>
            </div>
          )}

          {/* Voice coaching test — a direct tap here unlocks the AudioContext and
              speech synthesis so cues work from the very first moment of the session. */}
          <div className="bg-[#1E1E1E] rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl">🔊</span>
            <div className="flex-1">
              <p className="text-white/80 text-sm font-medium">Voice coaching</p>
              <p className="text-white/45 text-xs mt-0.5">Tap to enable — I'll count your reps and guide you.</p>
            </div>
            <button
              onClick={() => {
                voiceCoachRef.current.unlock()
                speakCue(
                  { key: 'voice-test', text: "Voice coaching is on. I'll guide you through your workout.", cooldownMs: 0 },
                  voiceEnabledRef.current
                )
              }}
              className="flex-shrink-0 px-4 py-2 rounded-full bg-sage/20 text-sage-light text-xs font-semibold
                         active:bg-sage/35 transition-colors border border-sage/30">
              Test voice
            </button>
          </div>
        </div>
        <div className="px-5 pb-10">
          {saveError && (
            <div className="mb-3 rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-sm text-rose-light">
              {saveError}
            </div>
          )}
          <button onClick={() => { voiceCoachRef.current.unlock(); startSession() }}
            className="w-full bg-sage text-white rounded-full py-4 font-semibold text-base
                       shadow-[0_4px_16px_rgba(122,158,142,.4)] active:scale-[.97] transition-transform">
            Camera is set — begin session
          </button>
        </div>
      </div>
    )
  }

  // ── EXERCISE INTRO (first exercise + "Review setup") ──────────
  if (phase === 'exercise-intro') {
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col">
        <div className="flex items-center gap-4 px-5 pt-14 pb-4">
          <button onClick={handleExitRequest} aria-label="Exit session"
            className="flex items-center gap-1.5 text-white/50 active:text-white transition-colors text-sm">
            <BackArrow /><span>Exit</span>
          </button>
          <div className="flex-1 text-center">
            <p className="text-white/40 text-xs">Exercise {currentEx + 1} of {exercises.length}</p>
          </div>
          <div className="font-serif text-sage-light tabular-nums text-sm">{formatDuration(elapsed)}</div>
        </div>

        <div className="flex-1 px-5 pt-2 pb-32 overflow-y-auto flex flex-col gap-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-sage/20 flex items-center justify-center text-lg flex-shrink-0">🧘‍♀️</div>
              <div>
                <p className="text-white font-semibold text-sm">{exercise?.name}</p>
                <p className="text-white/40 text-xs mt-0.5 capitalize">
                  {targetReps} {isHold ? 'second hold' : 'reps'} · {exercise?.difficulty}
                </p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">{exercise?.description}</p>
          </div>

          <div className="bg-[#1E1E1E] rounded-2xl p-5">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Starting position</p>
            <p className="text-white/80 text-sm leading-relaxed">{cue.start}</p>
          </div>

          <div className="bg-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">What to focus on</p>
            <div className="flex gap-3">
              <span className="text-sage-light mt-0.5 flex-shrink-0">✓</span>
              <p className="text-white/80 text-sm leading-relaxed">{cue.watch}</p>
            </div>
            <div className="h-px bg-white/8"/>
            <div className="flex gap-3">
              <span className="text-rose-light mt-0.5 flex-shrink-0">✗</span>
              <p className="text-white/80 text-sm leading-relaxed">{cue.avoid}</p>
            </div>
          </div>

          {exercise?.instructions && exercise.instructions.length > 0 && (
            <div className="bg-[#1E1E1E] rounded-2xl p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Step by step</p>
              <div className="flex flex-col gap-2.5">
                {exercise.instructions.map((step: string, i: number) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-sage/60 text-xs font-bold mt-0.5 flex-shrink-0">{i+1}</span>
                    <p className="text-white/65 text-sm leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4
                        bg-gradient-to-t from-charcoal via-charcoal to-transparent">
          {introPaused ? (
            <button onClick={beginExercise}
              className="w-full bg-sage text-white rounded-full py-4 font-semibold text-base
                         shadow-[0_4px_16px_rgba(122,158,142,.4)] active:scale-[.97] transition-transform">
              {introIsReview ? 'Resume exercise' : "I'm ready — start exercise"}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="font-serif text-4xl text-white w-10 text-center tabular-nums">{introCount}</div>
                <button onClick={beginExercise}
                  className="flex-1 bg-sage text-white rounded-full py-3.5 font-semibold text-sm
                             shadow-[0_4px_16px_rgba(122,158,142,.4)] active:scale-[.97] transition-transform">
                  Start now
                </button>
              </div>
              <button onClick={() => {
                if (introTimerRef.current) clearInterval(introTimerRef.current)
                setIntroPaused(true)
              }} className="text-white/40 text-xs active:text-white/70 transition-colors py-1">
                Pause to review setup
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── TRANSITION ────────────────────────────────────────────────
  if (phase === 'transition') {
    const isLast = currentEx >= exercises.length - 1
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-sage/20 border-2 border-sage flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#A8C5B5" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <div>
          <p className="text-sage-light text-sm font-semibold uppercase tracking-widest mb-2">Exercise complete</p>
          <h2 className="font-serif text-2xl text-white mb-1">{exercise?.name}</h2>
          <p className="text-white/50 text-sm">
            {isHold ? `${targetReps}s hold ✓` : `${targetReps} reps ✓`}
          </p>
        </div>

        {!isLast && (
          <div className="bg-[#1E1E1E] rounded-2xl p-5 w-full max-w-xs">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">Next up</p>
            <p className="font-serif text-lg text-white mb-1">{nextEx?.name}</p>
            <p className="text-white/50 text-xs">
              {exercises[currentEx+1]?.reps_override ?? nextEx?.default_reps} {nextEx?.duration_type === 'hold' ? 'sec hold' : 'reps'}
            </p>
          </div>
        )}

        <div className="text-center">
          <div className="font-serif text-5xl text-white">{transitionCount}</div>
          <p className="text-white/40 text-xs mt-1">{isLast ? 'finishing in' : 'auto-starting in'}</p>
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={() => {
            if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
            repCountRef.current = 0; setRepCount(0); setHoldElapsed(0); autoAdvancedRef.current = false
            primeActiveStage(); setPhase('active')
          }} className="flex-1 py-3 rounded-full bg-white/10 text-white/70 text-sm font-medium active:bg-white/20">
            Repeat
          </button>
          {!isLast && (
            <button onClick={() => {
              if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
              const nextIdx = currentEx + 1
              setCurrentEx(nextIdx); repCountRef.current = 0; setRepCount(0); setHoldElapsed(0); autoAdvancedRef.current = false
              setIntroPaused(true)    // user explicitly chose to review — pause auto-countdown
              setIntroIsReview(false) // coming from transition, not mid-exercise (no "Resume" wording needed)
              setPhase('exercise-intro')
            }} className="flex-1 py-3 rounded-full bg-white/8 text-white/60 text-sm font-medium active:bg-white/15">
              Review setup
            </button>
          )}
          <button onClick={() => {
            if (transitionTimerRef.current) clearInterval(transitionTimerRef.current)
            advanceToNext()
          }} className="flex-1 py-3 rounded-full bg-sage text-white text-sm font-semibold active:opacity-80">
            {isLast ? 'Finish' : 'Start now'}
          </button>
        </div>
      </div>
    )
  }

  // ── SKIP CONFIRM ──────────────────────────────────────────────
  if (phase === 'skip-confirm') {
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="text-4xl">⏭</div>
        <div>
          <h2 className="font-serif text-2xl text-white mb-2">Skip this exercise?</h2>
          <p className="text-white/55 text-sm leading-relaxed">
            {exercise?.name} will be marked as skipped and not counted in your score.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={confirmSkip}
            className="w-full py-3.5 rounded-full bg-white/15 text-white text-sm font-semibold active:bg-white/25">
            Yes, skip it
          </button>
          <button onClick={() => { setPaused(false); setPhase('active') }}
            className="w-full py-3.5 rounded-full bg-sage text-white text-sm font-semibold
                       shadow-[0_4px_14px_rgba(122,158,142,.3)] active:opacity-80">
            Keep going
          </button>
        </div>
      </div>
    )
  }

  // ── EXIT CONFIRM ──────────────────────────────────────────────
  if (phase === 'exit-confirm') {
    const pct = Math.round((completedExercises.length / exercises.length) * 100)
    return (
      <div className="min-h-dvh bg-charcoal flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="text-4xl">🚪</div>
        <div>
          <h2 className="font-serif text-2xl text-white mb-2">Exit session?</h2>
          <p className="text-white/55 text-sm leading-relaxed">
            {completedExercises.length} of {exercises.length} exercises done
            {skippedExercises.length > 0 ? `, ${skippedExercises.length} skipped` : ''}
            {elapsed > 0 ? ` · ${formatDuration(elapsed)}` : ''}.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {saveError && (
            <div className="rounded-xl border border-rose/25 bg-rose/10 px-4 py-3 text-sm text-rose-light">
              {saveError}
            </div>
          )}
          {elapsed > 10 && completedExercises.length > 0 && (
            <button onClick={saveAndExit}
              className="w-full py-3.5 rounded-full bg-sage text-white text-sm font-semibold
                         shadow-[0_4px_14px_rgba(122,158,142,.3)] active:opacity-80">
              Save progress &amp; exit
            </button>
          )}
          <button onClick={discardAndExit}
            className="w-full py-3.5 rounded-full bg-white/10 text-white/70 text-sm font-medium active:bg-white/20">
            Discard session
          </button>
          <button onClick={() => { setPaused(false); setPhase('active') }}
            className="w-full py-3.5 rounded-full bg-transparent text-white/50 text-sm active:text-white">
            Continue session
          </button>
        </div>
      </div>
    )
  }

  // ── FINISHED ──────────────────────────────────────────────────
  if (phase === 'finished') {
    // Use ref for count — state may lag one render behind after endSession sets phase
    const finalDoneCnt   = completedExRef.current.length
    const fullyCompleted = finalDoneCnt >= exercises.length - skippedExercises.length
    const displayedSummary = sessionSummary ?? fallbackSummary(buildSummaryInput({
      locale,
      formScore: avgScore,
      durationSeconds: elapsed,
      exercisesCompleted: finalDoneCnt,
      skippedExercises: skippedExercises.length,
    }))
    return (
      <div className="min-h-dvh bg-cream flex flex-col">
        <div className={`px-6 pt-14 pb-8 relative overflow-hidden
          bg-gradient-to-br ${fullyCompleted ? 'from-sage to-sage-dark' : 'from-charcoal-mid to-charcoal'}`}>
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/8"/>
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 mb-4 text-xs text-white font-semibold">
            {fullyCompleted ? '🌿 Session complete' : '💾 Progress saved'}
          </div>
          <h1 className="font-serif text-3xl text-white mb-2">
            {fullyCompleted ? 'Well done!' : 'Good work so far'}
          </h1>
          <p className="text-white/70 text-sm">
            {fullyCompleted
              ? 'You felt your progress today.'
              : `${finalDoneCnt} of ${exercises.length} exercises completed.`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5 mt-5">
          {[
            { val: isPro && avgScore > 0 ? `${avgScore}%` : '—', label: 'Form score' },
            { val: formatDuration(elapsed), label: 'Duration' },
            { val: `${finalDoneCnt}/${exercises.length}`, label: fullyCompleted ? 'Completed' : 'Done / total' },
          ].map(s => (
            <div key={s.label} className="card text-center py-4">
              <div className="font-serif text-xl text-charcoal mb-0.5">{s.val}</div>
              <div className="text-[11px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {skippedExercises.length > 0 && (
          <div className="mx-5 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700">{skippedExercises.length} exercise{skippedExercises.length > 1 ? 's' : ''} skipped — not counted in your score.</p>
          </div>
        )}

        {fullyCompleted && (
          <div className="mx-5 mt-4 card border-l-4 border-l-sage pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-dark">{displayedSummary.headline}</p>
            <p className="mt-2 text-sm text-charcoal-mid italic leading-relaxed">"{displayedSummary.body}"</p>
            <p className="text-xs text-sage-dark font-semibold mt-2">— Forma AI Coach</p>
          </div>
        )}

        {isPersonalizedIntro && fullyCompleted && !postSessionFeeling && (
          <section className="mx-5 mt-4 card" aria-labelledby="post-session-feeling-heading">
            <h2 id="post-session-feeling-heading" className="font-serif text-xl text-charcoal">How does your body feel now?</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">This helps Forma adjust what comes next. Choose the closest answer.</p>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Post-session body feeling">
              {([
                ['better', 'Better'],
                ['unchanged', 'Same'],
                ['worse', 'Worse'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" disabled={savingPostSessionFeeling}
                  onClick={() => savePostSessionFeeling(value)}
                  className="min-h-12 rounded-2xl border border-sage/25 bg-sage/5 px-2 text-sm font-semibold text-sage-dark disabled:opacity-50">
                  {label}
                </button>
              ))}
            </div>
            {saveError && <p role="alert" className="mt-3 text-xs text-rose-dark">{saveError}</p>}
          </section>
        )}

        {isPersonalizedIntro && fullyCompleted && postSessionFeeling && !isPro && entitlement === 'allow_free_personalized' && (
          <section className="mx-5 mt-4 rounded-3xl bg-sage-dark p-5 text-white shadow-soft" aria-labelledby="intro-trial-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-light">Your first session is complete</p>
            <h2 id="intro-trial-heading" className="mt-2 font-serif text-xl">Keep your plan adapting.</h2>
            <p className="mt-2 text-xs leading-relaxed text-white/70">Start a seven-day trial to continue with personalized sessions and report updates.</p>
            <form action="/api/stripe/checkout?plan=monthly&trial=true" method="post" className="mt-4"
              onSubmit={() => trackAssessmentEvent('trial_start', { step_name: 'trial', outcome: 'started' })}>
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-sage-dark">
                Start my seven-day trial
              </button>
            </form>
          </section>
        )}

        {!isPro && !isPersonalizedIntro && (
          <div className="mx-5 mt-4 card border border-sage/30 bg-sage/5">
            <p className="font-serif text-base text-charcoal mb-1">Want real-time form feedback?</p>
            <p className="text-xs text-muted mb-3">Upgrade to Pro to unlock AI camera analysis.</p>
            <UpgradeButton plan="monthly" className="btn-primary text-sm py-2.5 px-5 inline-flex">
              Upgrade to Pro →
            </UpgradeButton>
          </div>
        )}

        <div className="px-5 mt-4 flex flex-col gap-3 pb-10">
          <button onClick={() => router.push('/home')} className="btn-primary w-full justify-center py-4 text-base">
            Back to home
          </button>
          <button onClick={() => router.push('/progress')} className="btn-secondary w-full justify-center">
            View my progress
          </button>
        </div>
      </div>
    )
  }

  // ── ACTIVE SESSION ────────────────────────────────────────────
  const holdPct = isHold ? Math.min((holdElapsed / targetReps) * 100, 100) : 0
  const circumference = 2 * Math.PI * 28

  // ── ACTIVE · CAMERA-FIRST (Pro AI camera) ─────────────────────
  // The camera fills the screen and IS the experience. Detailed instructions
  // live on the intro/setup screen and in voice prompts; here we keep only a
  // minimal floating overlay (exercise name, rep/timer, one status chip) plus
  // controls that float over the video instead of stealing vertical space.
	  if (isPro) {
	    const calibrating = activeStage === 'calibrating'
	    return (
	      <div className="fixed inset-0 h-[100dvh] w-screen bg-black overflow-hidden">
	        {repFlash && (
	          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
	            <div className="rep-pulse rounded-full bg-sage-light/90 px-8 py-5 text-5xl font-bold text-white shadow-[0_0_40px_rgba(122,158,142,.45)] animate-pulse">
	              +1
	            </div>
	          </div>
	        )}
	        {/* Full-bleed camera — the primary product surface */}
	        <PoseCamera
          onPoseResult={handlePoseResult}
          active={!paused}
          exerciseName={exercise?.name}
          isFloorExercise={isFloorExercise}
          formScoreSupported={!isFloorExercise}
          cameraOrientation={trackingProfile.cameraOrientation}
          trackingLandmarks={trackingProfile.landmarks}
          trackingMinVisibility={trackingProfile.minVisibility}
          fill
          overlayMode={calibrating ? 'calibration' : 'minimal'}
        />

        {poseDebugEnabled && (
          <div className="absolute left-3 top-28 z-50 rounded-md bg-black/75 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
            <div>{aiRepPhase}</div>
            <div>{repDiagnostics.usable ? 'usable' : 'blocked'} · points {repDiagnostics.visible}/{repDiagnostics.required}</div>
            <div>conf {repDiagnostics.confidence.toFixed(2)} · delta {repDiagnostics.delta.toFixed(3)}</div>
            <div>engage {trackingProfile.engageThreshold.toFixed(3)} · return {trackingProfile.returnThreshold.toFixed(3)}</div>
            <button
              onClick={downloadDebugLog}
              className="mt-2 rounded bg-white/15 px-2 py-1 font-sans text-[10px] font-semibold text-white/85 active:bg-white/25"
            >
              Download debug log
            </button>
          </div>
        )}

        {/* Brief exercise-name flash on auto-start */}
        {showNameOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-40 pointer-events-none"
               style={{ animation: 'fadeOut 3s ease forwards' }}>
            <div className="text-center px-6">
              <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Now</p>
              <p className="font-serif text-2xl text-white">{exercise?.name}</p>
              <p className="text-white/60 text-sm mt-1">{targetReps} {isHold ? 'second hold' : 'reps'}</p>
            </div>
          </div>
        )}

        {/* Top-center: exercise name + progress (timer appears once live) */}
        <div className="absolute top-[max(3rem,env(safe-area-inset-top))] inset-x-0 flex justify-center z-30 px-24 pointer-events-none">
          <div className="bg-black/45 backdrop-blur-sm rounded-2xl px-4 py-1.5 text-center max-w-full">
            <p className="font-serif text-sm text-white leading-tight truncate">{exercise?.name}</p>
            <p className="text-white/55 text-[10px] tabular-nums">
              {currentEx + 1} / {exercises.length}{!calibrating ? ` · ${formatDuration(elapsed)}` : ''}
            </p>
          </div>
        </div>

        {/* Bottom chrome — floats over the camera via a gradient, no hard panel */}
        <div className="absolute bottom-0 inset-x-0 z-30 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-20
                        bg-gradient-to-t from-black/85 via-black/45 to-transparent">
          {calibrating ? (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center min-h-[3.5rem] flex flex-col justify-end">
                {calibReady && calibCountdown !== null ? (
                  <>
                    <div className="font-serif text-5xl text-white tabular-nums leading-none">{calibCountdown}</div>
                    <p className="text-sage-light text-xs mt-1.5">Hold still — starting automatically</p>
                  </>
                ) : (
                  <div role="status" aria-live="polite" className="space-y-1">
                    <p className="text-white text-sm font-semibold">
                      {calibBlocker?.title ?? 'Checking camera setup'}
                    </p>
                    <p className="text-white/65 text-xs leading-snug max-w-xs mx-auto">
                      {calibBlocker?.detail ?? 'I am checking orientation, framing, confidence, and visible key points.'}
                    </p>
                    {calibBlocker?.stats && (
                      <p className="text-white/35 text-[11px] leading-tight">
                        {calibBlocker.stats}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 w-full max-w-sm">
                <button onClick={handleExitRequest} aria-label="Exit session"
                  className="px-4 py-3 rounded-full bg-white/10 text-white/70 text-xs font-medium active:bg-white/20">
                  Exit
                </button>
                {showStartAnyway ? (
                  <button onClick={startExercising}
                    className="flex-1 py-3.5 rounded-full bg-sage text-white text-sm font-semibold
                               shadow-[0_4px_16px_rgba(122,158,142,.4)] active:scale-[.97] transition-transform">
                    Start anyway
                  </button>
                ) : (
                  <div className="flex-1 py-3.5 rounded-full bg-white/8 text-white/45 text-xs font-medium text-center border border-white/10">
                    Start anyway appears soon
                  </div>
                )}
                <button onClick={handleSkipRequest} aria-label="Skip exercise"
                  className="px-4 py-3 rounded-full bg-white/10 text-white/60 text-xs font-medium active:bg-white/20">
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* AI status line — mirrors the spoken cue, counted-rep exercises only */}
              {!isComplete && !isHold && aiRepSupported && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                                      ${AI_STATUS_TONE_CLASSES[aiStatus.tone]}`}>
                      {aiStatus.tone === 'tracking' && '🤖 '}
                      {aiStatus.tone === 'attention' && '👀 '}
                      {aiStatus.tone === 'success' && '✓ '}
                      {aiStatus.chip}
                    </span>
                    {repFlash && (
                      <span className="px-3 py-1 rounded-full bg-sage/30 text-sage-light text-xs font-semibold animate-pulse">
                        +1
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1 px-8" aria-label="Rep cycle">
                    {(['Start', 'Move', 'Return', 'Count'] as const).map(stage => (
                      <div
                        key={stage}
                        className={`h-1.5 rounded-full ${cycleStage === stage ? 'bg-sage-light' : 'bg-white/15'}`}
                        aria-label={stage}
                      />
                    ))}
                  </div>
                  {qualityCue && (
                    <p className="px-1 text-center text-[13px] leading-snug text-sage-light" aria-live="polite">
                      {qualityCue}
                    </p>
                  )}
                  {movementStale && (
                    <p className="px-1 text-center text-[12px] leading-snug text-white/55" aria-live="polite">
                      AI stuck? Use + to count manually.
                    </p>
                  )}
                </div>
              )}

              {/* Primary count / hold display */}
              {isComplete ? (
                <div className="w-full py-3 rounded-2xl bg-sage/25 text-sage-light text-sm font-semibold text-center">
                  ✓ Complete — moving to next…
                </div>
              ) : isHold ? (
                <div className="flex items-center justify-center">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg width="80" height="80" viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4"/>
                      <circle cx="32" cy="32" r="28" fill="none"
                        stroke="#A8C5B5" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (holdPct/100)*circumference}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}/>
                    </svg>
                    <div className="relative text-center">
                      <div className="font-serif text-2xl leading-none text-white">{Math.max(0, targetReps - holdElapsed)}</div>
                      <div className="text-white/40 text-[9px]">sec</div>
                    </div>
                  </div>
                </div>
              ) : aiRepSupported ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => adjustRep(-1)} aria-label="Decrease rep count"
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-black/45 text-white text-xl
                               font-semibold active:bg-black/60 transition-colors border border-white/15">
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <div className="font-serif text-4xl text-white leading-none tabular-nums">{repCount}</div>
                    <div className="text-white/45 text-[11px] mt-0.5">/ {targetReps} reps · tap ± to adjust</div>
                  </div>
                  <button onClick={() => adjustRep(1)} aria-label="Increase rep count"
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-black/45 text-white text-xl
                               font-semibold active:bg-black/60 transition-colors border border-white/15">
                    +
                  </button>
                </div>
              ) : (
                <button onClick={handleRep} aria-label="Count one rep"
                  className="w-full py-3.5 rounded-2xl bg-black/45 text-white text-sm font-semibold
                             active:bg-black/60 transition-colors border border-white/15">
                  + Count rep &nbsp;({repCount}/{targetReps})
                </button>
              )}

              {/* Control row — Exit / Pause / Setup / Skip */}
              <div className="flex items-center justify-between">
                <button onClick={handleExitRequest} aria-label="Exit session"
                  className="flex items-center gap-1 text-white/55 active:text-white transition-colors text-xs px-2 py-1">
                  <BackArrow /> Exit
                </button>
                <button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume' : 'Pause'}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all
                    ${paused ? 'bg-sage/25 text-sage-light' : 'bg-black/45 text-white/70 border border-white/15'}`}>
                  {paused ? <><PlayIcon/> Resume</> : <><PauseIcon/> Pause</>}
                </button>
                <button onClick={() => { setIntroPaused(true); setIntroIsReview(true); setPhase('exercise-intro') }}
                  className="text-white/45 text-xs active:text-white/70 transition-colors px-2 py-1">
                  Setup
                </button>
                <button onClick={handleSkipRequest} aria-label="Skip exercise"
                  className="flex items-center gap-1 text-white/55 active:text-white transition-colors text-xs px-2 py-1">
                  Skip <SkipIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

	  // ── ACTIVE · FREE (no camera — classic dashboard layout) ──────
	  return (
	    <div className="min-h-dvh bg-charcoal flex flex-col">
	      {repFlash && (
	        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
	          <div className="rep-pulse rounded-full bg-sage-light/90 px-8 py-5 text-5xl font-bold text-white shadow-[0_0_40px_rgba(122,158,142,.45)] animate-pulse">
	            +1
	          </div>
	        </div>
	      )}
	      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 pt-14 pb-3 bg-charcoal">
        <button onClick={handleExitRequest} aria-label="Exit session"
          className="flex items-center gap-1 text-white/40 active:text-white transition-colors text-xs">
          <BackArrow /><span>Exit</span>
        </button>
        <div className="flex-1 text-center">
          <p className="font-serif text-sm text-white leading-tight">{exercise?.name}</p>
          <p className="text-white/40 text-[11px]">{currentEx+1} / {exercises.length}</p>
        </div>
        <div className="font-serif text-sage-light tabular-nums text-sm">{formatDuration(elapsed)}</div>
      </div>

      {/* Camera or placeholder */}
      <div className="relative">
        {isPro
          ? <PoseCamera
              onPoseResult={handlePoseResult}
              active={!paused}
              exerciseName={exercise?.name}
              isFloorExercise={isFloorExercise}
              formScoreSupported={!isFloorExercise}
              cameraOrientation={trackingProfile.cameraOrientation}
              trackingLandmarks={trackingProfile.landmarks}
              trackingMinVisibility={trackingProfile.minVisibility}
            />
          : <PlaceholderCamera exercise={exercise} />
        }

        {/* Exercise name overlay — fades in 3s after auto-start */}
        {showNameOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20
                          animate-[fadeOut_3s_ease_forwards]"
               style={{ animation: 'fadeOut 3s ease forwards' }}>
            <div className="text-center px-6">
              <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Now</p>
              <p className="font-serif text-2xl text-white">{exercise?.name}</p>
              <p className="text-white/60 text-sm mt-1">
                {targetReps} {isHold ? 'second hold' : 'reps'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-charcoal px-5 py-3 flex items-center justify-between">
        <button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume' : 'Pause'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all
            ${paused ? 'bg-sage/20 text-sage-light' : 'bg-white/8 text-white/60'}`}>
          {paused
            ? <><PlayIcon/> Resume</>
            : <><PauseIcon/> Pause</>}
        </button>

        {/* Rep / Hold display */}
        {isHold ? (
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4"/>
              <circle cx="32" cy="32" r="28" fill="none"
                stroke={isComplete ? '#6BAE8C' : '#A8C5B5'} strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (holdPct/100)*circumference}
                style={{ transition: 'stroke-dashoffset 1s linear' }}/>
            </svg>
            <div className="relative text-center">
              <div className={`font-serif text-xl leading-none ${isComplete ? 'text-sage-light' : 'text-white'}`}>
                {isComplete ? '✓' : targetReps - holdElapsed}
              </div>
              <div className="text-white/35 text-[9px]">{isComplete ? 'done' : 'sec'}</div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`font-serif text-4xl leading-none transition-colors ${isComplete ? 'text-sage-light' : 'text-white'}`}>
              {repCount}
            </div>
            <div className="text-white/35 text-xs mt-0.5">/ {targetReps} reps</div>
          </div>
        )}

        <button onClick={handleSkipRequest} aria-label="Skip exercise"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/8 text-white/50 text-xs
                     font-medium active:bg-white/15 transition-all">
          Skip <SkipIcon />
        </button>
      </div>

      {/* Rep / hold action */}
      <div className="px-5 pb-2">
        {isComplete ? (
          <div className="w-full py-3 rounded-2xl bg-sage/20 text-sage-light text-sm font-semibold text-center">
            ✓ Complete — moving to next…
          </div>
        ) : isHold ? (
          <div className="w-full py-3 rounded-2xl bg-white/5 text-white/35 text-sm text-center">
            Hold steady · breathe into it
          </div>
        ) : isPro && aiRepSupported ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                                transition-colors ${AI_STATUS_TONE_CLASSES[aiStatus.tone]}`}>
                {aiStatus.tone === 'tracking' && '🤖 '}
                {aiStatus.tone === 'attention' && '👀 '}
                {aiStatus.tone === 'success' && '✓ '}
                {aiStatus.chip}
              </span>
              {repFlash && (
                <span className="px-3 py-1.5 rounded-full bg-sage/25 text-sage-light text-xs font-semibold animate-pulse shrink-0">
                  Rep counted +1
                </span>
              )}
            </div>
            {/* Status message — large enough to read from across the room, mirrors the spoken cue */}
            <p role="status" aria-live="polite" className="px-1 text-[13px] leading-snug text-white/55">
              {aiStatus.message}
            </p>
                    {qualityCue && (
                      <p className="px-1 text-[13px] leading-snug text-sage-light" aria-live="polite">
                        {qualityCue}
                      </p>
                    )}
                    {movementStale && (
                      <p className="px-1 text-[12px] leading-snug text-white/55" aria-live="polite">
                        AI stuck? Use + to count manually.
                      </p>
                    )}
            <div className="grid grid-cols-4 gap-1" aria-label="Rep cycle">
              {(['Start', 'Move', 'Return', 'Count'] as const).map(stage => (
                <div
                  key={stage}
                  className={`h-1.5 rounded-full ${cycleStage === stage ? 'bg-sage-light' : 'bg-white/15'}`}
                  aria-label={stage}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => adjustRep(-1)} aria-label="Decrease rep count"
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/8 text-white text-lg
                           font-semibold active:bg-white/15 transition-colors border border-white/10">
                −
              </button>
              <div className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white text-sm font-semibold text-center border border-white/10">
                {repCount}/{targetReps} reps
              </div>
              <button onClick={() => adjustRep(1)} aria-label="Increase rep count"
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/8 text-white text-lg
                           font-semibold active:bg-white/15 transition-colors border border-white/10">
                +
              </button>
            </div>
            <p className="text-center text-[11px] text-white/35">
              Manual count available · tap +/− to adjust
            </p>
          </div>
        ) : isPro && !aiRepSupported ? (
          <div className="space-y-2">
            <div className="px-3 py-2 rounded-xl bg-white/5 text-white/45 text-xs text-center">
              AI form feedback is active — rep counting for this move is coming soon. Manual rep counting for now.
            </div>
            <button onClick={handleRep} aria-label="Count one rep"
              className="w-full py-3.5 rounded-2xl bg-white/10 text-white text-sm font-semibold
                         active:bg-white/20 transition-colors border border-white/10">
              + Count rep &nbsp;({repCount}/{targetReps})
            </button>
          </div>
        ) : (
          <button onClick={handleRep} aria-label="Count one rep"
            className="w-full py-3.5 rounded-2xl bg-white/10 text-white text-sm font-semibold
                       active:bg-white/20 transition-colors border border-white/10">
            + Count rep &nbsp;({repCount}/{targetReps})
          </button>
        )}
      </div>

      {/* Review setup link */}
      <div className="px-5 pb-2 flex justify-center">
        <button onClick={() => {
          // NOTE: do NOT call setPaused(true) here — timers stop automatically when phase
          // leaves 'active', and leaving paused=true causes a stuck "Resume" button on return.
          setIntroPaused(true); setIntroIsReview(true); setPhase('exercise-intro')
        }}
          className="text-white/30 text-xs active:text-white/60 transition-colors py-1 px-3">
          Review setup for this exercise
        </button>
      </div>

      {/* Queue */}
      <div className="flex-1 bg-[#1E1E1E] px-5 py-3 overflow-y-auto">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2">Queue</p>
        <div className="flex flex-col gap-1.5">
          {exercises.map((se: any, i: number) => {
            const isSkipped = skippedExercises.includes(i)
            const isDone    = completedExercises.includes(i)
            return (
              <div key={se.exercise_id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl
                  ${i === currentEx ? 'bg-sage/18' : ''} ${isSkipped || (i < currentEx && !isDone) ? 'opacity-30' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isDone ? 'bg-sage/30 text-sage-light' :
                    isSkipped ? 'bg-white/10 text-white/30' :
                    i === currentEx ? 'bg-sage text-white' :
                    'bg-white/10 text-white/40'}`}>
                  {isDone ? '✓' : isSkipped ? '⏭' : i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${i === currentEx ? 'text-white' : 'text-white/60'}`}>{se.exercise?.name}</p>
                </div>
                <p className="text-white/25 text-[10px] flex-shrink-0">
                  {se.reps_override ?? se.exercise?.default_reps}{se.exercise?.duration_type === 'hold' ? 's' : 'r'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function PlaceholderCamera({ exercise }: { exercise: any }) {
  return (
    <div className="w-full bg-[#1A1A1A] flex items-center justify-center" style={{ aspectRatio: '4/3' }}>
      <div className="text-center px-8">
        <div className="text-4xl mb-3">🧘‍♀️</div>
        <p className="font-serif text-lg text-white mb-1">{exercise?.name}</p>
        <p className="text-white/45 text-xs leading-relaxed line-clamp-2 mb-5">{exercise?.description}</p>
        <UpgradeButton plan="monthly"
          className="block w-full bg-sage/20 border border-sage/40 rounded-2xl px-4 py-3
                     active:bg-sage/35 text-left">
          <span className="block text-sage-light text-xs font-semibold mb-1">✨ Unlock AI form analysis</span>
          <span className="block text-white/50 text-[11px] leading-relaxed">
            Get real-time posture + alignment feedback live as you move.
            Upgrade to Pro for unlimited sessions too.
          </span>
          <span className="block text-sage-light text-xs font-semibold mt-2">Upgrade to Pro →</span>
        </UpgradeButton>
      </div>
    </div>
  )
}

function SetupRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-8 text-center flex-shrink-0">{icon}</span>
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">{label}</p>
        <p className="text-white/85 text-sm mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function CameraSetupDiagram({ category }: { category: string }) {
  const isFloor = ['core','cool_down','hips'].includes(category)
  const isFront = category === 'shoulders'
  return (
    <svg viewBox="0 0 280 160" className="w-full max-w-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="140" x2="260" y2="140" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeDasharray="4,3"/>
      {isFloor ? (
        <g stroke="rgba(168,197,181,.8)" strokeWidth="2" strokeLinecap="round">
          <ellipse cx="60" cy="125" rx="8" ry="8" fill="none"/>
          <line x1="68" y1="125" x2="180" y2="125"/>
          <line x1="120" y1="125" x2="110" y2="115"/><line x1="120" y1="125" x2="110" y2="135"/>
          <line x1="160" y1="125" x2="155" y2="112"/><line x1="155" y1="112" x2="165" y2="100"/>
          <line x1="160" y1="125" x2="155" y2="138"/><line x1="155" y1="138" x2="165" y2="148"/>
        </g>
      ) : (
        <g stroke="rgba(168,197,181,.8)" strokeWidth="2" strokeLinecap="round">
          <circle cx="140" cy="55" r="9" fill="none"/>
          <line x1="140" y1="64" x2="140" y2="105"/>
          <line x1="115" y1="75" x2="165" y2="75"/>
          <line x1="115" y1="75" x2="105" y2="100"/><line x1="165" y1="75" x2="175" y2="100"/>
          <line x1="140" y1="105" x2="125" y2="130"/><line x1="125" y1="130" x2="125" y2="140"/>
          <line x1="140" y1="105" x2="155" y2="130"/><line x1="155" y1="130" x2="155" y2="140"/>
        </g>
      )}
      <rect x={isFront ? 220 : 228} y="88" width="30" height="22" rx="4"
        fill="rgba(122,158,142,.3)" stroke="rgba(122,158,142,.7)" strokeWidth="1.5"/>
      <circle cx={isFront ? 235 : 243} cy="99" r="5" fill="none" stroke="rgba(122,158,142,.7)" strokeWidth="1.5"/>
      <line x1={isFront ? 220 : 228} y1="99" x2="175" y2="99"
        stroke="rgba(122,158,142,.4)" strokeWidth="1" strokeDasharray="4,3"/>
      <text x="243" y="78" textAnchor="middle" fill="rgba(122,158,142,.8)" fontSize="10" fontFamily="Inter">📷</text>
    </svg>
  )
}

function formatSavedAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function BackArrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}
function PlayIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
}
function PauseIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
}
function SkipIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
}

function generateFeedback(score: number): string {
  if (score >= 90) return "Outstanding session. Your alignment is improving with every practice."
  if (score >= 80) return "Your form is building beautifully. Keep core engaged before each movement."
  if (score >= 70) return "Solid work. Notice where your body compensates and breathe into those areas."
  return "Every session builds the foundation. Quality over speed — your body is learning."
}
