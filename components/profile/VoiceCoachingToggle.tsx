'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  initialEnabled: boolean
}

/**
 * Persisted on/off switch for spoken AI-camera coaching prompts
 * (rep-counting status, framing guidance, transition announcements).
 * When off, the same cues still fall back to a short tone + haptic buzz —
 * see lib/voiceCoach.ts — so users always get *some* signal.
 */
export default function VoiceCoachingToggle({ userId, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving]   = useState(false)
  const supabase = createClient()

  async function toggle() {
    if (saving) return
    const next = !enabled
    setEnabled(next)   // optimistic — settings toggles should feel instant
    setSaving(true)
    const { error } = await supabase
      .from('user_profiles')
      .update({ voice_coaching_enabled: next })
      .eq('id', userId)
    if (error) setEnabled(!next)  // revert on failure
    setSaving(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-label="Toggle voice coaching"
      aria-pressed={enabled}
      className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-60
                  ${enabled ? 'bg-sage' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
                        ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
