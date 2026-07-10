'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { CameraOrientation } from '@/lib/exerciseTracking'
import { visibleLandmarkCount } from '@/lib/poseTracking'

// Full MediaPipe Pose connection set — face, arms, hands, torso, legs and feet.
// The MVP draws the complete skeleton (MediaPipe POSE_CONNECTIONS) which reads as
// far more "alive" and complete than a sparse stick figure, so we match it here.
const CONNECTIONS: [number, number][] = [
  // face
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
  // arms + hands
  [11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
  [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
  // torso
  [11,23],[12,24],[23,24],
  // legs + feet
  [23,25],[25,27],[27,29],[27,31],[29,31],
  [24,26],[26,28],[28,30],[28,32],[30,32],
]

// Landmarks we draw as joints (every tracked point we have, when visible).
const JOINT_LM = Array.from({ length: 33 }, (_, i) => i)

// Landmark indices for full-body confidence check
const UPPER_BODY_LM = [11, 12, 13, 14, 23, 24]   // shoulders + elbows + hips
const LOWER_BODY_LM = [25, 26, 27, 28]            // knees + ankles
const HEAD_LM       = [0]                          // nose

export type FramingStatus =
  | 'full-body'     // all key landmarks visible — safe to score
  | 'upper-body'    // shoulders+hips visible, no lower body
  | 'partial'       // some landmarks but not enough
  | 'no-body'       // nothing detected

/** How the on-camera chrome should be rendered:
 *  - 'full'        legacy: LIVE + framing chip + form score + feedback + guidance
 *  - 'calibration' camera-first setup: prominent framing guidance + status, camera switch, no score
 *  - 'minimal'     camera-first during the exercise: one tiny status chip + camera switch only
 *    (the parent owns exercise name / reps / timer, and voice carries the coaching) */
export type OverlayMode = 'full' | 'calibration' | 'minimal'
export type CameraLifecycleStatus = 'loading' | 'ready' | 'unavailable'

export interface PoseResult {
  /** 0–100 form score, or null when no honest score can be computed for this
   *  exercise/camera view (e.g. side-view mat work). null ≠ 0 — null means "we
   *  deliberately don't score this", 0 would mean "scored, and it was bad". */
  formScore: number | null
  feedback: { text: string; type: 'good' | 'warn' }[]
  landmarks: any[]
  framingStatus: FramingStatus
  bodyConfidence: number   // 0–1 avg visibility of key landmarks
  diagnostics: PoseDiagnostics
}

export interface PoseDiagnostics {
  sourceWidth: number
  sourceHeight: number
  detectionFps: number
  visibleLandmarks: number
  trackedLandmarks: number
  bodyConfidence: number
  poseResults: number
  lastPoseAgeMs: number | null
  inputKind: 'video' | 'canvas'
  deviceClass: 'phone' | 'tablet' | 'desktop'
  orientation: 'portrait' | 'landscape'
}

interface Props {
  onPoseResult?: (result: PoseResult) => void
  onCameraStatus?: (status: CameraLifecycleStatus) => void
  active?: boolean
  /** The exercise currently being performed — used to show exercise-specific framing guidance. */
  exerciseName?: string
  /**
   * When true the camera preview uses a landscape (16:9) aspect ratio. The
   * camera stream itself stays 4:3 so tablets keep the uncropped sensor view.
   */
  isFloorExercise?: boolean
  /**
   * Whether a meaningful form score can honestly be computed for this exercise.
   * The alignment checks (shoulders/hips level, spine stacked) only hold for an
   * upright, front-facing body. For side-view / mat poses they're geometrically
   * invalid, so we suppress the score entirely rather than show a fabricated
   * number. Defaults to true.
   */
  formScoreSupported?: boolean
  /**
   * Camera-first / full-bleed mode. When true the component fills its (relative)
   * parent absolutely instead of reserving a fixed aspect-ratio box. The parent
   * is responsible for sizing — typically the whole screen.
   */
  fill?: boolean
  /** Controls how much chrome is drawn over the video. Defaults to 'full'. */
  overlayMode?: OverlayMode
  /** Preferred physical device orientation from the exercise tracking profile. */
  cameraOrientation?: CameraOrientation
  /** Profile landmarks used by the opt-in diagnostics panel. */
  trackingLandmarks?: number[]
  trackingMinVisibility?: number
  /** Lets an assessment parent own retry/fallback actions without duplicate controls. */
  recoveryMode?: 'internal' | 'external'
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.crossOrigin = 'anonymous'
    s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })
}

// MediaPipe Pose is loaded from a CDN at runtime. If the primary CDN is
// unreachable (outage, blocked network, ad-blocker), fall back to a mirror so a
// Pro user's whole session doesn't break. The base that successfully loads is
// also used for `locateFile` so the model/WASM assets come from the same place.
const POSE_CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
  'https://unpkg.com/@mediapipe/pose',
]

/** Loads pose.js from the first reachable CDN; returns that CDN's base URL. */
async function loadPoseFromCdn(): Promise<string> {
  let lastErr: unknown
  for (const base of POSE_CDN_BASES) {
    try {
      await loadScript(`${base}/pose.js`)
      if ((window as any).Pose) return base
    } catch (err) { lastErr = err }
  }
  throw new Error(
    `MediaPipe failed to load from all CDNs${lastErr ? `: ${String((lastErr as any)?.message ?? lastErr)}` : ''}`
  )
}

/** Avg visibility of a set of landmarks, returns 0 if any index missing */
function avgVisibility(lm: any[], indices: number[]): number {
  if (!lm || lm.length < 29) return 0
  const vals = indices.map(i => lm[i]?.visibility ?? 0)
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function visibleBounds(lm: any[], indices: number[], minVisibility = 0.25) {
  const pts = indices
    .map(i => lm[i])
    .filter(p => p && (p.visibility ?? 0) >= minVisibility)
  if (!pts.length) return null
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  return {
    count: pts.length,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function classifyFraming(lm: any[], isFloorExercise = false): { status: FramingStatus; bodyConfidence: number } {
  if (!lm || lm.length < 29) return { status: 'no-body', bodyConfidence: 0 }

  const upperConf = avgVisibility(lm, UPPER_BODY_LM)
  const lowerConf = avgVisibility(lm, LOWER_BODY_LM)
  const headConf  = avgVisibility(lm, HEAD_LM)
  const overallConf = (upperConf * 0.4 + lowerConf * 0.4 + headConf * 0.2)

  // Mat/floor exercises are usually side-view and partially self-occluded. A user
  // can be fully visible to the camera while MediaPipe assigns low visibility to
  // the far wrist/ankle or the hidden-side knee. For these poses, gate on the
  // torso + at least one lower-body segment and a reasonable on-screen body span
  // instead of requiring every distal landmark to be high-confidence.
  if (isFloorExercise) {
    const floorLm = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28]
    const bounds = visibleBounds(lm, floorLm, 0.25)
    const torsoConf = avgVisibility(lm, [11, 12, 23, 24])
    const kneeConf = avgVisibility(lm, [25, 26])
    const ankleConf = avgVisibility(lm, [27, 28])
    const spanX = bounds ? bounds.maxX - bounds.minX : 0
    const spanY = bounds ? bounds.maxY - bounds.minY : 0
    const withinFrame = !!bounds
      && bounds.minX > -0.08 && bounds.maxX < 1.08
      && bounds.minY > -0.08 && bounds.maxY < 1.08
    const enoughBodySpan = spanX > 0.22 || spanY > 0.28
    const lowerBodyReadable = kneeConf >= 0.32 || ankleConf >= 0.28
    const bodyConfidence = (torsoConf * 0.55) + (Math.max(kneeConf, ankleConf) * 0.35) + (headConf * 0.10)

    if (torsoConf >= 0.42 && lowerBodyReadable && (bounds?.count ?? 0) >= 5 && withinFrame && enoughBodySpan) {
      return { status: 'full-body', bodyConfidence }
    }
    if (torsoConf >= 0.42 && !lowerBodyReadable) {
      return { status: 'upper-body', bodyConfidence: torsoConf * 0.55 }
    }
    if (bodyConfidence > 0.24 || (bounds?.count ?? 0) >= 4) {
      return { status: 'partial', bodyConfidence: bodyConfidence * 0.6 }
    }
    return { status: 'no-body', bodyConfidence: 0 }
  }

  if (upperConf >= 0.65 && lowerConf >= 0.65) {
    return { status: 'full-body', bodyConfidence: overallConf }
  }
  if (upperConf >= 0.55 && lowerConf < 0.4) {
    return { status: 'upper-body', bodyConfidence: upperConf * 0.5 }
  }
  if (overallConf > 0.3) {
    return { status: 'partial', bodyConfidence: overallConf * 0.4 }
  }
  return { status: 'no-body', bodyConfidence: 0 }
}

// Landmarks the front-view alignment checks depend on. If any aren't clearly
// visible, the resulting coordinates are unreliable, so we don't score.
const FORM_REQUIRED_LM = [11, 12, 23, 24, 25, 26, 27, 28]

/**
 * Front-view form analysis. Returns null when it can't produce an honest score —
 * either the required landmarks aren't confidently visible. Only called when
 * framing is full-body AND the exercise is a front-facing, upright pose
 * (see `formScoreSupported`).
 */
function analyseForm(lm: any[]): { formScore: number; feedback: { text: string; type: 'good'|'warn' }[] } | null {
  // Visibility gate — don't score off landmarks we can't actually see.
  if (FORM_REQUIRED_LM.some(i => (lm[i]?.visibility ?? 0) < 0.5)) return null

  const fb: { text: string; type: 'good'|'warn' }[] = []
  let score = 100

  // Shoulder level
  if (Math.abs(lm[11].y - lm[12].y) > 0.06) {
    fb.push({ text: 'Level your shoulders', type: 'warn' }); score -= 15
  } else {
    fb.push({ text: 'Shoulders aligned ✓', type: 'good' })
  }

  // Hip level
  if (Math.abs(lm[23].y - lm[24].y) > 0.05) {
    fb.push({ text: 'Even your hips', type: 'warn' }); score -= 10
  } else {
    fb.push({ text: 'Hips level ✓', type: 'good' })
  }

  // Spine alignment (shoulder mid vs hip mid)
  const sMidX = (lm[11].x + lm[12].x) / 2
  const hMidX = (lm[23].x + lm[24].x) / 2
  if (Math.abs(sMidX - hMidX) > 0.07) {
    fb.push({ text: 'Stack over your hips', type: 'warn' }); score -= 10
  } else {
    fb.push({ text: 'Spine aligned ✓', type: 'good' })
  }

  // Knee tracking (knees over toes, rough check via knee vs ankle x-offset)
  const leftKneeOffset  = Math.abs(lm[25].x - lm[27].x)
  const rightKneeOffset = Math.abs(lm[26].x - lm[28].x)
  if (leftKneeOffset > 0.08 || rightKneeOffset > 0.08) {
    fb.push({ text: 'Knees tracking forward', type: 'warn' }); score -= 10
  }

  const warns = fb.filter(f => f.type === 'warn')
  const goods = fb.filter(f => f.type === 'good')
  return {
    formScore: Math.max(0, Math.min(100, score)),
    feedback: warns.length > 0
      ? [...warns.slice(0,1), ...goods.slice(0,1)]
      : goods.slice(0,2),
  }
}

const FRAMING_GUIDANCE: Record<FramingStatus, { headline: string; tips: string[] }> = {
  'no-body': {
    headline: "We can't see you yet",
    tips: [
      "Move back until your full body is visible",
      "We need to see you from head to feet",
      "Improve lighting if the room is dim",
    ],
  },
  'upper-body': {
    headline: "Only your upper body is visible",
    tips: [
      "Tilt the screen or camera downward until your feet enter the frame",
      "On a laptop, place the camera near hip height, about 2–3 m away",
      "Keep your head and feet visible at the same time",
    ],
  },
  'partial': {
    headline: "You're partially out of frame",
    tips: [
      "Tilt the screen or camera downward until your feet enter the frame",
      "On a laptop, place the camera near hip height, about 2–3 m away",
      "Improve lighting if the room is dim",
    ],
  },
  'full-body': { headline: '', tips: [] },
}

/** Exercise-specific framing tips shown when the camera can't see the full body.
 *  These override the generic tips when the exercise name matches. */
const EXERCISE_FRAMING_TIPS: Record<string, { headline: string; tips: string[] }> = {
  'Cat-Cow Stretch': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 8-10 ft to the side — your whole spine must be visible",
      "Camera should be at mat level so it captures head to tailbone",
      "For Cat-Cow the side view is essential — face the camera sideways",
    ],
  },
  'Plank Hold': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 8-10 ft to the side at floor level",
      "Your full body from head to heels must be in frame",
      "Side view only — keep both hands and feet visible",
    ],
  },
  "Child's Pose Hold": {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 6-8 ft to the side at floor level",
      "Your hips, back, and extended arms all need to be visible",
    ],
  },
  'Glute Bridge': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 6-8 ft to the side at mat level",
      "Full side view — head, hips, and feet must all be visible",
      "Prop phone on a water bottle or stool so it stays level with the mat",
    ],
  },
  'Pelvic Tilts': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 6-8 ft to the side at mat level",
      "Full side view — lower back, hips, and knees must all be visible",
    ],
  },
  'Swan Prep': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 8-10 ft to the side at mat level",
      "Full side view from head to feet, lying face-down",
    ],
  },
  'Hundred': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 8-10 ft to the side at mat level",
      "Full side view — head curl and extended legs must both be visible",
    ],
  },
  'Single Leg Stretch': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 8-10 ft to the side at mat level",
      "Full side view — the extended leg is the key part to keep in frame",
    ],
  },
  'Clamshell': {
    headline: "Can't see your full body",
    tips: [
      "Place phone in landscape 5-6 ft to the front at mat level",
      "Face the camera — both stacked knees and the rotating hip must be visible",
    ],
  },
}

// How often (ms) to run pose detection on the video frame. Mobile browsers need
// a much smaller compute budget, especially after the camera was promoted to a
// full-screen surface.
const DESKTOP_DETECT_INTERVAL_MS = 130
const TABLET_DETECT_INTERVAL_MS  = 180
const MOBILE_DETECT_INTERVAL_MS  = 280
const DESKTOP_DRAW_INTERVAL_MS   = 33
const TABLET_DRAW_INTERVAL_MS    = 50
const MOBILE_DRAW_INTERVAL_MS    = 66
const DETECTION_INPUT_WIDTH      = 640
const DETECTION_INPUT_HEIGHT     = 480
// How often (ms) to push new score / feedback / framing values into React state.
// Keeps re-renders to ~3/sec instead of on every detection tick.
const UI_UPDATE_INTERVAL_MS = 300
const DEGRADED_FRAME_HOLD = 4

export default function PoseCamera({
  onPoseResult, onCameraStatus, active = true, exerciseName,
  isFloorExercise = false, formScoreSupported = true,
  fill = false, overlayMode = 'full',
  cameraOrientation = 'either', trackingLandmarks = [], trackingMinVisibility = 0.5,
  recoveryMode = 'internal',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const getDeviceInfo = (): {
    deviceClass: PoseDiagnostics['deviceClass']
    orientation: PoseDiagnostics['orientation']
    width: number
    height: number
  } => {
    if (typeof window === 'undefined') {
      return { deviceClass: 'phone' as const, orientation: 'portrait' as const, width: 0, height: 0 }
    }
    const width = window.innerWidth
    const height = window.innerHeight
    const touch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    const deviceClass = !touch ? 'desktop' : Math.min(width, height) >= 700 ? 'tablet' : 'phone'
    return { deviceClass, orientation: width > height ? 'landscape' as const : 'portrait' as const, width, height }
  }
  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo)
  const isDesktop = deviceInfo.deviceClass === 'desktop'
  const isTablet = deviceInfo.deviceClass === 'tablet'
  const isMobile = deviceInfo.deviceClass === 'phone'

  // Start with the front camera on every device. It is the most reliable default
  // for mobile browsers and lets the user see setup/tracking feedback while
  // placing the phone. Rear camera is still available through the flip button.
  const initialFacing: 'user' | 'environment' = 'user'

  const poseRef       = useRef<any>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number>(0)
  const canvasSizeRef = useRef({ w: 0, h: 0 })
  const lastDetectAt  = useRef(0)
  const lastDrawAt    = useRef(0)
  const lastUiUpdateAt = useRef(0)
  const lastDebugUpdateAt = useRef(0)
  const noBodyFrames  = useRef(0)
  const lastLandmarksRef = useRef<any[] | null>(null)
  const detectionWindowRef = useRef({ startedAt: 0, count: 0, fps: 0 })
  const poseResultCountRef = useRef(0)
  const lastPoseResultAtRef = useRef<number | null>(null)
  // Front camera is mirrored (natural "selfie" view); rear camera is not.
  const mirroredRef   = useRef(initialFacing === 'user')

  // Mirrors that let long-lived loops/callbacks always read the freshest
  // values without forcing the camera to be torn down and rebuilt whenever
  // the parent re-renders (e.g. on every timer tick, rep count, form score).
  const activeRef       = useRef(active)
  const onPoseResultRef = useRef(onPoseResult)
  const onCameraStatusRef = useRef(onCameraStatus)
  const formScoreSupportedRef = useRef(formScoreSupported)
  const isFloorExerciseRef = useRef(isFloorExercise)
  const trackingConfigRef = useRef({ landmarks: trackingLandmarks, minVisibility: trackingMinVisibility })
  const deviceInfoRef = useRef(deviceInfo)
  const debugEnabledRef = useRef(false)
  const facingRef       = useRef<'user' | 'environment'>(initialFacing)
  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { onPoseResultRef.current = onPoseResult }, [onPoseResult])
  useEffect(() => { onCameraStatusRef.current = onCameraStatus }, [onCameraStatus])
  useEffect(() => { formScoreSupportedRef.current = formScoreSupported }, [formScoreSupported])
  useEffect(() => { isFloorExerciseRef.current = isFloorExercise }, [isFloorExercise])
  useEffect(() => {
    trackingConfigRef.current = { landmarks: trackingLandmarks, minVisibility: trackingMinVisibility }
  }, [trackingLandmarks, trackingMinVisibility])
  useEffect(() => { deviceInfoRef.current = deviceInfo }, [deviceInfo])

  const [status,        setStatus]        = useState<'loading' | 'ready' | 'error'>('loading')
  const [score,         setScore]         = useState<number | null>(null)
  const [feedback,      setFeedback]      = useState<{ text: string; type: 'good' | 'warn' }[]>([])
  const [errMsg,        setErrMsg]        = useState('')
  const [framingStatus, setFramingStatus] = useState<FramingStatus>('no-body')
  const [facing,        setFacing]        = useState<'user' | 'environment'>(initialFacing)
  const [switching,     setSwitching]     = useState(false)
  const [cameraCount,   setCameraCount]   = useState(0)
  const [sourceSize,    setSourceSize]    = useState({ width: 4, height: 3 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [debugEnabled,  setDebugEnabled]  = useState(false)
  const [diagnostics,   setDiagnostics]   = useState<PoseDiagnostics>({
    sourceWidth: 0,
    sourceHeight: 0,
    detectionFps: 0,
    visibleLandmarks: 0,
    trackedLandmarks: trackingLandmarks.length,
    bodyConfidence: 0,
    poseResults: 0,
    lastPoseAgeMs: null,
    inputKind: isMobile || isTablet ? 'canvas' : 'video',
    deviceClass: deviceInfo.deviceClass,
    orientation: deviceInfo.orientation,
  })

  const emitCameraStatus = useCallback((next: CameraLifecycleStatus) => {
    onCameraStatusRef.current?.(next)
  }, [])
  useEffect(() => { debugEnabledRef.current = debugEnabled }, [debugEnabled])

  useEffect(() => {
    const updateDeviceInfo = () => setDeviceInfo(getDeviceInfo())
    updateDeviceInfo()
    window.addEventListener('resize', updateDeviceInfo)
    window.addEventListener('orientationchange', updateDeviceInfo)
    setDebugEnabled(new URLSearchParams(window.location.search).get('poseDebug') === '1')
    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      window.removeEventListener('orientationchange', updateDeviceInfo)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => setContainerSize({ width: container.clientWidth, height: container.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  /** Request the camera's uncropped 4:3 sensor view. Device orientation changes
   *  how that view is presented; a forced 16:9 stream can crop useful vertical
   *  field of view on tablets without adding horizontal field of view. */
  const videoConstraints = useCallback((face: 'user' | 'environment'): MediaTrackConstraints => {
    return isMobile
      ? { facingMode: { ideal: face }, width: { ideal: 640 }, height: { ideal: 480 } }
      : isTablet
        ? { facingMode: { ideal: face }, width: { ideal: 960 }, height: { ideal: 720 }, aspectRatio: { ideal: 4 / 3 } }
        : { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 960 }, aspectRatio: { ideal: 4 / 3 } }
  }, [isMobile, isTablet])

  const getDetectionImage = useCallback((video: HTMLVideoElement): CanvasImageSource => {
    if (!(isMobile || isTablet)) return video
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return video

    const canvas = detectionCanvasRef.current ?? document.createElement('canvas')
    if (!detectionCanvasRef.current) {
      canvas.width = DETECTION_INPUT_WIDTH
      canvas.height = DETECTION_INPUT_HEIGHT
      detectionCanvasRef.current = canvas
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return video

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min(canvas.width / vw, canvas.height / vh)
    const dw = vw * scale
    const dh = vh * scale
    const dx = (canvas.width - dw) / 2
    const dy = (canvas.height - dh) / 2
    ctx.drawImage(video, dx, dy, dw, dh)
    return canvas
  }, [isMobile, isTablet])

  /** Draw only the pose overlay. The real video element is visible underneath.
   *  This is much cheaper on mobile than copying the video into canvas every
   *  frame, and avoids iOS throttling quirks around tiny/hidden video elements. */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current, video = videoRef.current
    if (!canvas || !video || video.readyState < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize the backing buffer only when the video's intrinsic size changes —
    // never on every frame — so video and overlay stay pixel-aligned without
    // causing layout/paint thrash.
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480
    if (canvasSizeRef.current.w !== vw || canvasSizeRef.current.h !== vh) {
      canvas.width = vw
      canvas.height = vh
      canvasSizeRef.current = { w: vw, h: vh }
    }

    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const mirror = mirroredRef.current

    const lm = lastLandmarksRef.current
    if (!lm) return
    const xy = (i: number) => ({ x: (mirror ? (1 - lm[i].x) : lm[i].x) * W, y: lm[i].y * H })
    ctx.strokeStyle = 'rgba(168,197,181,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    CONNECTIONS.forEach(([a,b]) => {
      if (lm[a]?.visibility > 0.5 && lm[b]?.visibility > 0.5) {
        const pa = xy(a), pb = xy(b)
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
      }
    })
    JOINT_LM.forEach(i => {
      if (lm[i]?.visibility > 0.5) {
        const { x, y } = xy(i)
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(247,200,115,0.95)'; ctx.fill()
      }
    })
  }, [])

  /** Handle a fresh pose-detection result — throttled before it reaches React state. */
  const handlePoseResults = useCallback((results: any) => {
    const lm = results?.poseLandmarks ?? null
    lastLandmarksRef.current = lm

    const { status: framing, bodyConfidence } = classifyFraming(lm, isFloorExerciseRef.current)
    const trackingConfig = trackingConfigRef.current
    const currentDeviceInfo = deviceInfoRef.current
    const detectionNow = performance.now()
    const detectionWindow = detectionWindowRef.current
    poseResultCountRef.current += 1
    lastPoseResultAtRef.current = detectionNow
    if (!detectionWindow.startedAt) detectionWindow.startedAt = detectionNow
    detectionWindow.count += 1
    if (detectionNow - detectionWindow.startedAt >= 1_000) {
      detectionWindow.fps = detectionWindow.count * 1_000 / (detectionNow - detectionWindow.startedAt)
      detectionWindow.startedAt = detectionNow
      detectionWindow.count = 0
    }

    // Debounce degradation: only drop to a worse status after several
    // consecutive frames, so a single bad frame doesn't flicker the UI.
    if (framing === 'no-body' || framing === 'partial' || framing === 'upper-body') {
      noBodyFrames.current += 1
      if (noBodyFrames.current <= DEGRADED_FRAME_HOLD) return
    } else {
      noBodyFrames.current = 0
    }

    // Throttle React state churn — UI only needs a few updates per second.
    const now = performance.now()
    if (now - lastUiUpdateAt.current < UI_UPDATE_INTERVAL_MS) return
    lastUiUpdateAt.current = now

    setFramingStatus(prev => (prev === framing ? prev : framing))

    if (framing === 'full-body') {
      // Only compute a score when it's geometrically honest for this exercise's
      // camera view AND the required landmarks are visible. Otherwise score is
      // null ("not scored") — never a fabricated number.
      const analysis = formScoreSupportedRef.current ? analyseForm(lm) : null
      setScore(analysis ? analysis.formScore : null)
      setFeedback(analysis ? analysis.feedback : [])
      const nextDiagnostics: PoseDiagnostics = {
        sourceWidth: videoRef.current?.videoWidth ?? 0,
        sourceHeight: videoRef.current?.videoHeight ?? 0,
        detectionFps: detectionWindow.fps,
        visibleLandmarks: visibleLandmarkCount(lm, trackingConfig.landmarks, trackingConfig.minVisibility),
        trackedLandmarks: trackingConfig.landmarks.length,
        bodyConfidence,
        poseResults: poseResultCountRef.current,
        lastPoseAgeMs: 0,
        inputKind: currentDeviceInfo.deviceClass === 'phone' || currentDeviceInfo.deviceClass === 'tablet' ? 'canvas' : 'video',
        deviceClass: currentDeviceInfo.deviceClass,
        orientation: currentDeviceInfo.orientation,
      }
      setDiagnostics(nextDiagnostics)
      onPoseResultRef.current?.({
        formScore: analysis ? analysis.formScore : null,
        feedback: analysis ? analysis.feedback : [],
        landmarks: lm, framingStatus: framing, bodyConfidence,
        diagnostics: nextDiagnostics,
      })
    } else {
      setScore(null)
      setFeedback([])
      const nextDiagnostics: PoseDiagnostics = {
        sourceWidth: videoRef.current?.videoWidth ?? 0,
        sourceHeight: videoRef.current?.videoHeight ?? 0,
        detectionFps: detectionWindow.fps,
        visibleLandmarks: visibleLandmarkCount(lm, trackingConfig.landmarks, trackingConfig.minVisibility),
        trackedLandmarks: trackingConfig.landmarks.length,
        bodyConfidence,
        poseResults: poseResultCountRef.current,
        lastPoseAgeMs: 0,
        inputKind: currentDeviceInfo.deviceClass === 'phone' || currentDeviceInfo.deviceClass === 'tablet' ? 'canvas' : 'video',
        deviceClass: currentDeviceInfo.deviceClass,
        orientation: currentDeviceInfo.orientation,
      }
      setDiagnostics(nextDiagnostics)
      onPoseResultRef.current?.({
        formScore: null, feedback: [], landmarks: lm ?? [], framingStatus: framing, bodyConfidence,
        diagnostics: nextDiagnostics,
      })
    }
  }, [])

  /** Persistent render+detection loop. The browser schedules us every animation
   *  frame, but on mobile we intentionally draw/detect less often to keep the
   *  page responsive enough for real movement. */
  const loop = useCallback((ts: number) => {
    rafRef.current = requestAnimationFrame(loop)
    const drawInterval = isMobile
      ? MOBILE_DRAW_INTERVAL_MS
      : isTablet ? TABLET_DRAW_INTERVAL_MS : DESKTOP_DRAW_INTERVAL_MS
    if (ts - lastDrawAt.current > drawInterval) {
      lastDrawAt.current = ts
      drawFrame()
    }
    const detectInterval = isMobile
      ? MOBILE_DETECT_INTERVAL_MS
      : isTablet ? TABLET_DETECT_INTERVAL_MS : DESKTOP_DETECT_INTERVAL_MS
    if (activeRef.current && poseRef.current && videoRef.current
        && ts - lastDetectAt.current > detectInterval) {
      lastDetectAt.current = ts
      poseRef.current.send({ image: getDetectionImage(videoRef.current) })
    }
    if (debugEnabledRef.current && ts - lastDebugUpdateAt.current > 1_000) {
      lastDebugUpdateAt.current = ts
      const lastPoseAt = lastPoseResultAtRef.current
      const video = videoRef.current
      setDiagnostics(prev => ({
        ...prev,
        sourceWidth: video?.videoWidth ?? prev.sourceWidth,
        sourceHeight: video?.videoHeight ?? prev.sourceHeight,
        poseResults: poseResultCountRef.current,
        lastPoseAgeMs: lastPoseAt ? Math.round(performance.now() - lastPoseAt) : null,
        inputKind: isMobile || isTablet ? 'canvas' : 'video',
      }))
    }
  }, [drawFrame, getDetectionImage, isMobile, isTablet])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    poseRef.current?.close?.()
    poseRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    canvasSizeRef.current = { w: 0, h: 0 }
    lastLandmarksRef.current = null
    noBodyFrames.current = 0
    poseResultCountRef.current = 0
    lastPoseResultAtRef.current = null
  }, [])

  /**
   * Initialise the camera + pose model exactly once. The MediaStream and the
   * MediaPipe instance live for the whole component lifetime — pause/resume,
   * exercise transitions, rep/score updates etc. never tear this down again
   * (see `active`/`onPoseResult` mirrors above and the mount-only effect below).
   */
  const startCamera = useCallback(async () => {
    stopCamera()
    emitCameraStatus('loading')
    setStatus('loading')
    setErrMsg('')
    try {
      const face = facingRef.current
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(face),
        audio: false,
      })
      streamRef.current = stream
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setCameraCount(devices.filter(device => device.kind === 'videoinput').length)
      } catch {
        setCameraCount(0)
      }
      mirroredRef.current = face === 'user'
      const video = videoRef.current
      if (!video) throw new Error('Video element not ready')
      video.srcObject = stream
      await video.play()
      setSourceSize({ width: video.videoWidth || 4, height: video.videoHeight || 3 })

      const cdnBase = await loadPoseFromCdn()
      const win = window as any

      const pose = new win.Pose({
        locateFile: (f: string) => `${cdnBase}/${f}`,
      })
      pose.setOptions({
        modelComplexity: isMobile || isTablet ? 0 : 1, smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: isMobile || isTablet ? 0.5 : 0.6,
        minTrackingConfidence: isMobile || isTablet ? 0.5 : 0.6,
      })
      pose.onResults(handlePoseResults)
      poseRef.current = pose

      lastDetectAt.current = 0
      lastUiUpdateAt.current = 0
      setStatus('ready')
      emitCameraStatus('ready')
      rafRef.current = requestAnimationFrame(loop)
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Unknown error')
      setStatus('error')
      emitCameraStatus('unavailable')
    }
  }, [stopCamera, emitCameraStatus, handlePoseResults, loop, videoConstraints, isMobile, isTablet])

  /**
   * Switch between available cameras. Only the MediaStream is swapped —
   * the pose model and the render loop keep running, so there's no flicker and
   * no model reload. Mirroring follows the camera (front = mirrored selfie view,
   * rear = as-seen). On failure (e.g. device has only one camera) we keep the
   * current stream.
   */
  const switchCamera = useCallback(async () => {
    if (switching) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    setSwitching(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(next),
        audio: false,
      })
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = stream
      const video = videoRef.current
      if (video) { video.srcObject = stream; await video.play() }
      if (video) setSourceSize({ width: video.videoWidth || 4, height: video.videoHeight || 3 })
      facingRef.current = next
      mirroredRef.current = next === 'user'
      canvasSizeRef.current = { w: 0, h: 0 }   // force a re-measure for the new resolution
      setFacing(next)
    } catch {
      // Keep the existing camera — nothing else changes.
    } finally {
      setSwitching(false)
    }
  }, [switching, videoConstraints])

  // Mount once. Intentionally NOT depending on `active` — pausing/resuming
  // must never restart getUserMedia or the pose model (that's what caused
  // the flicker / "tiny remounting preview" before).
  useEffect(() => {
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFullBody = framingStatus === 'full-body'
  const showSwitch = fill && status === 'ready' && cameraCount > 1
  // Exercise-specific framing guidance takes priority over the generic status message.
  const exerciseGuidance = exerciseName ? EXERCISE_FRAMING_TIPS[exerciseName] : undefined
  const guidance = exerciseGuidance ?? FRAMING_GUIDANCE[framingStatus]
  const adaptiveGuidanceTips = guidance.tips
  const needsLandscape = cameraOrientation === 'landscape' && deviceInfo.orientation === 'portrait'
  const sourceAspect = sourceSize.width / sourceSize.height
  const containerAspect = containerSize.height > 0 ? containerSize.width / containerSize.height : sourceAspect
  const frameStyle = sourceAspect >= containerAspect
    ? { width: '100%', height: `${containerSize.width / sourceAspect}px` }
    : { width: `${containerSize.height * sourceAspect}px`, height: '100%' }

  // Compact framing chip label/colour — the single "one status icon" the
  // camera-first minimal overlay keeps on screen.
  const framingChip = isFullBody
    ? { cls: 'bg-sage/80 text-white', label: <><span>✓</span> Full body</> }
    : framingStatus === 'upper-body'
    ? { cls: 'bg-amber-500/80 text-white', label: <><span>⚠</span> Upper body only</> }
    : framingStatus === 'partial'
    ? { cls: 'bg-amber-500/80 text-white', label: <><span>⚠</span> Partial frame</> }
    : { cls: 'bg-red-500/75 text-white', label: <><span>✗</span> Not detected</> }

  return (
    <div
      ref={containerRef}
      className={`bg-[#1A1A1A] overflow-hidden ${fill ? 'absolute inset-0 w-full h-full' : 'relative w-full'}`}
      style={fill ? undefined : { aspectRatio: isFloorExercise ? '16 / 9' : '3 / 4' }}
    >
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{ ...frameStyle, transform: 'translate(-50%, -50%)' }}
      >
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full ${facing === 'user' ? '-scale-x-100' : ''}`}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={event => setSourceSize({
            width: event.currentTarget.videoWidth || 4,
            height: event.currentTarget.videoHeight || 3,
          })}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1A1A1A]">
          <div className="w-8 h-8 border-2 border-sage/30 border-t-sage rounded-full animate-spin"/>
          <p className="text-white/60 text-xs">Starting AI camera…</p>
        </div>
      )}

      {/* Error / recovery */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1A1A1A] px-6 text-center">
          <div className="text-3xl">📷</div>
          <div>
            <p className="text-white/80 text-sm font-medium mb-1">Camera unavailable</p>
            <p className="text-white/45 text-xs leading-relaxed max-w-[220px] mx-auto">
              {errMsg?.toLowerCase().includes('permission') || errMsg?.toLowerCase().includes('denied')
                ? "Camera permission was denied. Allow camera access in your browser settings, then retry."
                : "We couldn't start the camera. You can retry, or continue your workout without live AI feedback."}
            </p>
          </div>
          {recoveryMode === 'internal' && (
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <button onClick={startCamera}
                className="w-full py-2.5 rounded-full bg-sage text-white text-xs font-semibold active:bg-sage-dark transition-colors">
                Retry camera
              </button>
              <button onClick={() => { stopCamera(); setStatus('ready') }}
                className="w-full py-2.5 rounded-full bg-white/10 text-white/70 text-xs font-medium active:bg-white/15 transition-colors">
                Continue without camera
              </button>
            </div>
          )}
          <details className="text-left w-full max-w-[220px] mt-1">
            <summary className="text-white/35 text-xs cursor-pointer">How to enable camera</summary>
            <p className="text-white/35 text-xs mt-2 leading-relaxed">
              Safari: Settings → Safari → Camera → Allow.<br/>
              Chrome: tap the lock icon in the address bar → Permissions → Camera → Allow.<br/>
              Then tap "Retry camera" above.
            </p>
          </details>
        </div>
      )}

      {/* Ready */}
      {status === 'ready' && (
        <>
          {needsLandscape && overlayMode === 'calibration' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-8 text-center">
              <div className="max-w-xs">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl">
                  ↻
                </div>
                <p className="text-lg font-semibold text-white">Rotate to landscape</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  This movement needs the wider camera view. Keep the device sideways, then place your full body in frame.
                </p>
              </div>
            </div>
          )}

          {debugEnabled && (
            <div className="absolute right-3 top-16 z-40 rounded-md bg-black/75 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
              <div>{diagnostics.deviceClass} · {diagnostics.orientation}</div>
              <div>{diagnostics.sourceWidth}×{diagnostics.sourceHeight} · input {diagnostics.inputKind} · {diagnostics.detectionFps.toFixed(1)} fps</div>
              <div>pose results {diagnostics.poseResults} · last pose {diagnostics.lastPoseAgeMs ?? 'n/a'}ms</div>
              <div>points {diagnostics.visibleLandmarks}/{diagnostics.trackedLandmarks} · conf {diagnostics.bodyConfidence.toFixed(2)}</div>
              <div>{framingStatus}</div>
            </div>
          )}

          {/* Camera flip — camera-first views only (calibration + minimal). */}
          {showSwitch && (
            <button onClick={switchCamera} disabled={switching} aria-label="Switch camera"
              className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm
                         flex items-center justify-center active:bg-black/70 transition-colors disabled:opacity-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-2h6l1 1"/>
                <path d="M14 19h6a2 2 0 0 0 2-2v-5"/>
                <path d="M18 22l-3-3 3-3M6 2l3 3-3 3" opacity="0.85"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          )}

          {/* ── FULL overlay (legacy / non-camera-first) ─────────────────── */}
          {overlayMode === 'full' && (
            <>
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-1.5 bg-black/55 rounded-full px-3 py-1.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
                  <span className="text-white text-[11px] font-semibold tracking-wider">LIVE</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold flex-shrink-0 ${framingChip.cls}`}>
                  {framingChip.label}
                </div>
                {isFullBody && score !== null && (
                  <div className="flex items-center gap-1.5 bg-black/55 rounded-full px-3 py-1.5 flex-shrink-0">
                    <span className="text-white/60 text-[10px]">Form</span>
                    <span className={`text-sm font-bold
                      ${score >= 85 ? 'text-green-300' : score >= 70 ? 'text-amber-300' : 'text-red-300'}`}>
                      {score}%
                    </span>
                  </div>
                )}
                {isFullBody && score === null && (
                  <div className="flex items-center gap-1.5 bg-black/55 rounded-full px-3 py-1.5 flex-shrink-0">
                    <span className="text-sage-light text-[11px] font-semibold">✓ Tracking</span>
                  </div>
                )}
              </div>

              {!isFullBody && !needsLandscape && (
                <div role="status" aria-live="polite"
                  className="absolute inset-x-0 bottom-0 top-12 flex flex-col items-center justify-center
                                z-10 bg-black/55 backdrop-blur-[2px] px-5 text-center">
                  <p className="text-white text-sm font-semibold mb-2.5">{guidance.headline}</p>
                  <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                    {adaptiveGuidanceTips.map(tip => (
                      <div key={tip} className="bg-white/15 rounded-xl px-3 py-2 text-left">
                        <p className="text-white/90 text-xs">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isFloorExercise && isDesktop && (
                <div className="absolute bottom-3 left-3 right-3 z-10 bg-amber-500/85 rounded-xl px-4 py-3">
                  <p className="text-white text-xs font-semibold leading-snug">
                    💻 Laptop camera not recommended for floor exercises
                  </p>
                  <p className="text-white/85 text-[11px] mt-1 leading-snug">
                    Use a phone in landscape mode, propped 8–10 ft to the side at mat level, with the screen visible.
                  </p>
                </div>
              )}

              {isFullBody && !(isFloorExercise && isDesktop) && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10 px-4">
                  {feedback.slice(0,2).map((f,i) => (
                    <div key={i}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium text-white
                        ${f.type === 'good' ? 'bg-sage/75' : 'bg-amber-500/75'}`}>
                      {f.text}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── CALIBRATION overlay (camera-first setup) ──────────────────
              Prominent, full-body-focused framing guidance so the user — who may
              be 6–8 ft away — can get fully in frame before the exercise starts. */}
          {overlayMode === 'calibration' && (
            <>
              <div className="absolute top-3 left-3 z-10">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${framingChip.cls}`}>
                  {framingChip.label}
                </div>
              </div>

              {!isFullBody && (
                <div role="status" aria-live="polite"
                  className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-end
                                z-10 px-5 pb-28 text-center bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                  <p className="text-white text-lg font-semibold mb-3">
                    {guidance.headline || 'Move until your full body is visible'}
                  </p>
                  <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                    {adaptiveGuidanceTips.slice(0, 2).map(tip => (
                      <div key={tip} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
                        <p className="text-white/90 text-xs">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isFullBody && !needsLandscape && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end z-10 px-5 pb-28 text-center">
                  <div className="flex items-center gap-2 bg-sage/85 rounded-full px-4 py-2">
                    <span className="text-white text-sm font-semibold">✓ You're all set — hold still</span>
                  </div>
                </div>
              )}

              {isFloorExercise && isDesktop && (
                <div className="absolute bottom-3 left-3 right-3 z-10 bg-amber-500/85 rounded-xl px-4 py-3">
                  <p className="text-white text-xs font-semibold leading-snug">
                    💻 Laptop camera not recommended for floor exercises
                  </p>
                  <p className="text-white/85 text-[11px] mt-1 leading-snug">
                    Use a phone in landscape mode, propped 8–10 ft to the side at mat level, with the screen visible.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── MINIMAL overlay (camera-first, during the exercise) ───────
              Just one small framing chip. Name / reps / timer live in the
              parent's floating chrome, and voice carries the coaching. */}
          {overlayMode === 'minimal' && (
            <div className="absolute top-3 left-3 z-10">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${framingChip.cls}`}>
                {framingChip.label}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
