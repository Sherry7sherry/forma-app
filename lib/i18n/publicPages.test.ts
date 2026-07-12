import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('bilingual public and app entry points', () => {
  it('exposes only en and zh landing parameters', () => {
    const source = readFileSync('app/[locale]/page.tsx', 'utf8')
    assert.match(source, /return \[\{ locale: 'en' \}, \{ locale: 'zh' \}\]/)
    assert.match(source, /if \(!isPublicLocale\(locale\)\) notFound\(\)/)
  })

  it('keeps localized landing pages public in the auth proxy', () => {
    const source = readFileSync('proxy.ts', 'utf8')
    assert.match(source, /PUBLIC_PATHS[\s\S]*'\/en'[\s\S]*'\/zh'/)
  })

  it('keeps internal testing behind the normal authenticated gates', () => {
    const source = readFileSync('proxy.ts', 'utf8')
    const publicPaths = source.match(/const PUBLIC_PATHS = \[(.*?)\]/s)?.[1] ?? ''
    assert.doesNotMatch(publicPaths, /internal/)
  })

  it('does not retain English-only bottom-nav labels', () => {
    const source = readFileSync('components/nav/BottomNav.tsx', 'utf8')
    assert.match(source, /useLocale\(\)/)
    assert.match(source, /translate\(locale, item\.labelKey\)/)
  })

  it('keeps the Chinese landing headline on one deliberate responsive line', () => {
    const messages = readFileSync('lib/i18n/messages/zh-CN.ts', 'utf8')
    const landing = readFileSync('components/landing/LandingPage.tsx', 'utf8')

    assert.match(messages, /'landing\.hero\.title': '更懂你的 AI 普拉提教练'/)
    assert.match(landing, /locale === 'zh-CN'/)
    assert.match(landing, /whitespace-nowrap/)
    assert.match(landing, /text-\[clamp\(1\.5rem,7\.2vw,2\.25rem\)\]/)
  })
})
