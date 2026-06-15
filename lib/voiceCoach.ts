// ── Voice Coach ─────────────────────────────────────────────────
// Lightweight spoken-feedback helper for AI camera sessions.
//
// Each cue carries a `key` used to throttle repeats — the same cue won't be
// spoken again until its cooldown elapses (default ~10s), so status changes
// that flicker frame-to-frame don't turn into an annoying loop of speech.
//
// When voice coaching is turned off (or speech synthesis isn't available),
// cues fall back to a short confirmation tone + haptic buzz so the user still
// gets *some* signal without needing to read the screen from across the room.

export interface VoiceCue {
  key: string
  text: string
  cooldownMs?: number
}

const DEFAULT_COOLDOWN_MS = 10_000

export function createVoiceCoach() {
  const lastSpokenAt: Record<string, number> = {}
  let audioCtx: AudioContext | null = null

  function canSpeak(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  /**
   * Must be called from a direct user-gesture handler (button tap / click).
   * Creates (or resumes) the AudioContext so tone/haptic fallbacks work, and
   * primes the speech-synthesis engine with a zero-volume utterance so the
   * first real cue isn't silently swallowed by the browser's autoplay policy.
   * Safe to call multiple times — only the first gesture matters.
   */
  function unlock() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (Ctx) {
        if (!audioCtx) {
          audioCtx = new Ctx() as AudioContext
        } else if ((audioCtx as AudioContext).state === 'suspended') {
          ;(audioCtx as AudioContext).resume()
        }
        // Near-silent click so the AudioContext is definitely running
        const ctx = audioCtx as AudioContext
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.01)
      }
    } catch { /* ignore */ }

    if (canSpeak()) {
      try {
        // Zero-volume warm-up utterance — makes the first real speak() fire
        // immediately instead of being delayed or dropped on iOS / Safari.
        const warmup = new SpeechSynthesisUtterance(' ')
        warmup.volume = 0
        window.speechSynthesis.speak(warmup)
      } catch { /* ignore */ }
    }
  }

  function speakAloud(text: string) {
    try {
      window.speechSynthesis.cancel() // don't stack utterances — always say the latest thing
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.02
      utter.pitch = 1.0
      utter.volume = 0.9
      window.speechSynthesis.speak(utter)
    } catch { /* speech synthesis can throw in some embedded contexts — fail silently */ }
  }

  /** Short, gentle two-tone chime — used as a non-verbal cue when voice is off/unavailable. */
  function playTone() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.setValueAtTime(880, now + 0.09)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.24)
      osc.onended = () => ctx.close()
    } catch { /* ignore — Web Audio isn't available everywhere */ }
  }

  function buzz() {
    try { navigator.vibrate?.(50) } catch { /* ignore */ }
  }

  /**
   * Speak a cue if its cooldown has elapsed. Returns true if something was
   * emitted (spoken or cued via tone/haptic), false if it was throttled.
   */
  function speak(cue: VoiceCue, voiceEnabled: boolean): boolean {
    const now = Date.now()
    const cooldown = cue.cooldownMs ?? DEFAULT_COOLDOWN_MS
    const last = lastSpokenAt[cue.key] ?? 0
    if (now - last < cooldown) return false
    lastSpokenAt[cue.key] = now

    if (voiceEnabled && canSpeak()) {
      speakAloud(cue.text)
    } else {
      playTone()
      buzz()
    }
    return true
  }

  /** Forget cooldown history (call when the exercise changes) and stop any speech in flight. */
  function reset() {
    for (const k of Object.keys(lastSpokenAt)) delete lastSpokenAt[k]
    if (canSpeak()) {
      try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    }
  }

  function stop() {
    if (canSpeak()) {
      try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    }
  }

  return { unlock, speak, reset, stop }
}

export type VoiceCoach = ReturnType<typeof createVoiceCoach>
