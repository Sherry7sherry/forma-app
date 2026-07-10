'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ locale: Locale; labelKey: 'language.english' | 'language.chinese'; helper: string }> = [
  { locale: 'en-US', labelKey: 'language.english', helper: 'English coaching, cues, and summaries' },
  { locale: 'zh-CN', labelKey: 'language.chinese', helper: '中文界面、提示和训练总结' },
]

export default function LanguageSelect({
  userId,
  initialLocale,
  onChange,
}: {
  userId: string
  initialLocale: Locale
  onChange?: (nextLocale: Locale) => void
}) {
  const supabase = createClient()
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(nextLocale: Locale) {
    if (nextLocale === locale || saving) return

    const previous = locale
    setLocale(nextLocale)
    setSaving(true)
    setError(null)

    const result = await supabase
      .from('user_profiles')
      .update({ preferred_locale: nextLocale })
      .eq('id', userId)

    setSaving(false)
    if (result.error) {
      setLocale(previous)
      setError('Unable to update coach language.')
      return
    }

    onChange?.(nextLocale)
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-sage/15 flex-shrink-0">
          🌐
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-charcoal">{translate(locale, 'language.label')}</div>
          <div className="text-xs text-muted">Changes apply on the next screen or session.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(option => (
          <button
            key={option.locale}
            type="button"
            disabled={saving}
            onClick={() => choose(option.locale)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left active:scale-[.98] transition-all disabled:opacity-60',
              locale === option.locale
                ? 'border-sage bg-sage/10 shadow-[0_0_0_2px_rgba(122,158,142,.12)]'
                : 'border-border bg-white'
            )}>
            <div className="text-sm font-semibold text-charcoal">{translate(option.locale, option.labelKey)}</div>
            <div className="text-[11px] text-muted mt-0.5 leading-snug">{option.helper}</div>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-rose-dark mt-2">{error}</p>}
    </div>
  )
}
