import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('bilingual profile migration and controls', () => {
  it('persists only supported profile locales', () => {
    const sql = readFileSync('supabase/migrations/010_bilingual_ai_coach_v1.sql', 'utf8')
    assert.match(sql, /preferred_locale text not null default 'en-US'/)
    assert.match(sql, /preferred_locale in \('en-US', 'zh-CN'\)/)
  })

  it('requires onboarding language selection before saving completion', () => {
    const source = readFileSync('app/onboarding/page.tsx', 'utf8')
    assert.match(source, /const \[locale, setLocale\].*Locale \| null/)
    assert.match(source, /disabled=\{[^}]*locale === null/)
    assert.match(source, /preferred_locale: locale/)
  })
})
