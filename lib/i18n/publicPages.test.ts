import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('bilingual public and app entry points', () => {
  it('exposes only en and zh landing parameters', () => {
    const source = readFileSync('app/[locale]/page.tsx', 'utf8')
    assert.match(source, /return \[\{ locale: 'en' \}, \{ locale: 'zh' \}\]/)
    assert.match(source, /if \(!isPublicLocale\(locale\)\) notFound\(\)/)
  })

  it('does not retain English-only bottom-nav labels', () => {
    const source = readFileSync('components/nav/BottomNav.tsx', 'utf8')
    assert.match(source, /useLocale\(\)/)
    assert.match(source, /translate\(locale, item\.labelKey\)/)
  })
})
