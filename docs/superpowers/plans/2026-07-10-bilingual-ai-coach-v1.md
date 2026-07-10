# Bilingual AI Coach V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Forma an explicit Chinese/English product language, localized real-time coaching cues, and a safe, structured AI-written post-session recap.

**Architecture:** Add one persisted `preferred_locale` to the profile and resolve locale centrally. Keep posture analysis and training-policy decisions deterministic; a server-only coach adapter receives a minimized completed-session payload and returns validated, language-matched prose. Browser TTS remains the V1 real-time transport; premium cloud audio stays behind an interface for a later release.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Supabase, browser SpeechSynthesis/Web Audio, native `fetch` to a server-only OpenAI Responses API adapter, Node built-in test runner.

## Global Constraints

- Persist only `zh-CN` and `en-US`; public landing paths are only `/zh` and `/en`.
- A user must explicitly choose language during onboarding; browser locale may only preselect, never save a choice.
- `evaluateCoaching()` and `deriveBodyMirror()` continue to make all safety, intensity, and exercise-selection decisions.
- No raw video, image, pose landmark, email, or injury free text leaves Forma for AI recap generation.
- Do not call an LLM in `PoseCamera`, `voiceCoach`, or per frame/rep/cue.
- All safety stop/hold language is reviewed local copy, never model-generated.
- Every model response is structured, schema-validated, length-limited, and has a local bilingual fallback.
- Preserve the current browser tone/haptic fallback when speech synthesis or a locale-matched voice is unavailable.
- Do not stage, revert, or modify existing unrelated worktree changes.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `lib/i18n/types.ts` | Locale unions, public locale mapping, message type contract. |
| `lib/i18n/resolve.ts` | Pure locale resolver and browser-speech locale matcher. |
| `lib/i18n/messages/en-US.ts` | English core-loop UI and cue-adjacent copy. |
| `lib/i18n/messages/zh-CN.ts` | Key-for-key Chinese core-loop UI and cue-adjacent copy. |
| `lib/i18n/index.ts` | Typed `messages`, `translate`, and `publicLocalePath` exports. |
| `lib/coach/cues.ts` | Allow-listed bilingual live cue variants, selected locally. |
| `lib/coach/types.ts` | Minimal recap input and validated recap output contracts. |
| `lib/coach/fallbacks.ts` | Safe bilingual recap fallback factory. |
| `lib/coach/summaryInput.ts` | Converts database-safe completed-session data to model input. |
| `lib/coach/validate.ts` | Rejects malformed, overlong, wrong-language, or forbidden recap outputs. |
| `lib/coach/prompt.ts` | Locale-specific system/developer instructions and JSON schema. |
| `lib/coach/providers/openai.ts` | Server-only Responses API adapter. |
| `app/api/coach/session-summary/route.ts` | Authenticates, loads one owned session record, calls/falls back from coach adapter. |
| `components/i18n/LanguageSelect.tsx` | Explicit setting/onboarding language control with optimistic Supabase persistence. |
| `components/i18n/LocaleProvider.tsx` | Client locale context for compact interactive components. |
| `components/landing/LandingPage.tsx` | Shared localized public landing view. |
| `app/[locale]/page.tsx` | Validates `/zh` or `/en` and renders the localized landing page. |
| `app/(app)/home/page.tsx`, `app/(app)/sessions/*`, `app/(app)/progress/page.tsx`, `app/(app)/profile/page.tsx` | Server-rendered core authenticated pages; receive locale and use typed message keys for every visible static label. |
| `supabase/migrations/010_bilingual_ai_coach_v1.sql` | `preferred_locale`, recap provenance/version fields, and constraints. |

## Task 1: Establish pure locale contracts and typed message parity

**Files:**
- Create: `lib/i18n/types.ts`
- Create: `lib/i18n/resolve.ts`
- Create: `lib/i18n/messages/en-US.ts`
- Create: `lib/i18n/messages/zh-CN.ts`
- Create: `lib/i18n/index.ts`
- Create: `lib/i18n/resolve.test.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Produces `Locale`, `PublicLocale`, `resolveLocale`, `toPublicLocale`, `publicLocalePath`, `translate`, and `messages` for every later task.
- `resolveLocale(input)` is pure and takes no server/browser globals.

- [ ] **Step 1: Write failing locale-resolution and catalog-parity tests**

```ts
// lib/i18n/resolve.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatMessage, messages, publicLocalePath, resolveLocale, toPublicLocale } from './index'

describe('locale resolution', () => {
  it('uses an authenticated account locale over public path and cookie values', () => {
    assert.equal(resolveLocale({ accountLocale: 'zh-CN', publicLocale: 'en', cookieLocale: 'en-US' }), 'zh-CN')
  })

  it('maps only supported public path values and falls back to English', () => {
    assert.equal(resolveLocale({ publicLocale: 'zh' }), 'zh-CN')
    assert.equal(resolveLocale({ publicLocale: 'fr' }), 'en-US')
    assert.equal(toPublicLocale('zh-CN'), 'zh')
    assert.equal(publicLocalePath('en-US'), '/en')
  })

  it('keeps the required message keys identical in both languages', () => {
    assert.deepEqual(Object.keys(messages['zh-CN']).sort(), Object.keys(messages['en-US']).sort())
  })

  it('formats only supplied named message tokens', () => {
    assert.equal(formatMessage('Hi {name}; {missing} stays.', { name: 'Sherry' }), 'Hi Sherry; {missing} stays.')
  })
})
```

Add these five source files and the test to `tsconfig.test.json` `include`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="locale resolution"`  
Expected: TypeScript compilation fails because `lib/i18n/index.ts` does not exist.

- [ ] **Step 3: Implement locale types, resolver, and the first complete message catalog**

```ts
// lib/i18n/types.ts
export const LOCALES = ['en-US', 'zh-CN'] as const
export type Locale = (typeof LOCALES)[number]
export const PUBLIC_LOCALES = ['en', 'zh'] as const
export type PublicLocale = (typeof PUBLIC_LOCALES)[number]

export const messageShape = {
  'nav.home': '', 'nav.sessions': '', 'nav.progress': '', 'nav.profile': '',
  'language.label': '', 'language.english': '', 'language.chinese': '',
  'onboarding.language.eyebrow': '', 'onboarding.language.title': '',
  'onboarding.language.body': '', 'onboarding.continue': '',
  'voice.calibrate': '', 'voice.exerciseStart': '', 'voice.transition': '', 'voice.finish': '',
  'summary.loading': '', 'summary.unavailable': '',
  'checkIn.title': '', 'checkIn.disclaimer': '', 'checkIn.save': '',
} as const
export type MessageKey = keyof typeof messageShape
export type MessageCatalog = Record<MessageKey, string>
```

```ts
// lib/i18n/resolve.ts
import type { Locale, PublicLocale } from './types'

const publicToLocale: Record<PublicLocale, Locale> = { en: 'en-US', zh: 'zh-CN' }

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en-US' || value === 'zh-CN'
}

export function isPublicLocale(value: string | null | undefined): value is PublicLocale {
  return value === 'en' || value === 'zh'
}

export function resolveLocale(input: {
  accountLocale?: string | null
  publicLocale?: string | null
  cookieLocale?: string | null
}): Locale {
  if (isLocale(input.accountLocale)) return input.accountLocale
  if (isPublicLocale(input.publicLocale)) return publicToLocale[input.publicLocale]
  if (isLocale(input.cookieLocale)) return input.cookieLocale
  return 'en-US'
}

export function toPublicLocale(locale: Locale): PublicLocale {
  return locale === 'zh-CN' ? 'zh' : 'en'
}

export function publicLocalePath(locale: Locale): `/${PublicLocale}` {
  return `/${toPublicLocale(locale)}`
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token
  )
}
```

Create both catalogs as `satisfies MessageCatalog`; use reviewed Chinese strings, not machine-translated fallback strings. `index.ts` exports the contracts and:

```ts
export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key]
}
```

- [ ] **Step 4: Run focused and full unit tests**

Run: `npm test -- --test-name-pattern="locale resolution"`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit only locale-contract files**

```bash
git add lib/i18n tsconfig.test.json
git commit -m "feat: add typed bilingual locale foundation"
```

## Task 2: Persist an explicit account language and make onboarding require it

**Files:**
- Create: `supabase/migrations/010_bilingual_ai_coach_v1.sql`
- Create: `components/i18n/LanguageSelect.tsx`
- Create: `components/i18n/LanguageSelect.test.ts`
- Modify: `app/onboarding/page.tsx`
- Modify: `app/(app)/profile/page.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes `Locale`, `translate`, and `resolveLocale` from Task 1.
- Produces `LanguageSelect({ userId, initialLocale, onChange? })` and a completed profile with `preferred_locale`.

- [ ] **Step 1: Add a migration-shape test before writing SQL**

```ts
// components/i18n/LanguageSelect.test.ts
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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="bilingual profile migration"`  
Expected: FAIL because the migration and selector are absent.

- [ ] **Step 3: Add database constraint and atomic onboarding persistence**

```sql
-- supabase/migrations/010_bilingual_ai_coach_v1.sql
alter table public.user_profiles
  add column if not exists preferred_locale text not null default 'en-US'
  check (preferred_locale in ('en-US', 'zh-CN'));

alter table public.session_records
  add column if not exists coach_summary_version text,
  add column if not exists coach_summary_status text
    check (coach_summary_status in ('generated', 'fallback', 'unavailable'));
```

In `app/onboarding/page.tsx`, change `STEPS` from `3` to `4`, introduce
`const [locale, setLocale] = useState<Locale | null>(null)`, and make the
first step a two-card explicit language choice. Move current goals/level/focus
to steps 2/3/4. In `finish()`, use one profile update:

```ts
const profileResult = await supabase.from('user_profiles')
  .update({ onboarding_completed: true, preferred_locale: locale })
  .eq('id', user.id)
```

Guard `finish()` with `if (!locale) throw new Error('Choose a language before continuing.')` and disable the first-step Continue button while `locale === null`. Do not accept `navigator.language` as a saved value.

Create `LanguageSelect` as a client component that updates only
`user_profiles.preferred_locale`, reverts optimistic state on Supabase error,
and calls optional `onChange(nextLocale)` after a successful write. Add it to
Profile's Preferences section with `initialLocale={profile?.preferred_locale ?? 'en-US'}` and extend that page's select list accordingly.

- [ ] **Step 4: Run focused and full checks**

Run: `npm test -- --test-name-pattern="bilingual profile migration"`  
Expected: PASS.  
Run: `npm run lint`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Apply migration in the configured Supabase environment, then commit**

Run the reviewed SQL in the project Supabase migration workflow. Confirm existing profiles read as `en-US` and the check constraint rejects `fr-FR`.

```bash
git add supabase/migrations/010_bilingual_ai_coach_v1.sql app/onboarding/page.tsx \
  'app/(app)/profile/page.tsx' components/i18n/LanguageSelect.tsx \
  components/i18n/LanguageSelect.test.ts tsconfig.test.json
git commit -m "feat: persist explicit coaching language"
```

## Task 3: Add canonical bilingual landing routes and localized core navigation

**Files:**
- Create: `components/landing/LandingPage.tsx`
- Create: `components/i18n/PublicLanguageSwitcher.tsx`
- Create: `app/[locale]/page.tsx`
- Create: `lib/i18n/publicPages.test.ts`
- Modify: `app/page.tsx`
- Modify: `components/nav/BottomNav.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes Task 1 catalogs and Task 2's profile field.
- Produces valid `/en` and `/zh` landing pages, a public switcher, and localized bottom-nav labels.

- [ ] **Step 1: Write source-level route and navigation tests**

```ts
// lib/i18n/publicPages.test.ts
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
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="bilingual public and app entry points"`  
Expected: FAIL because dynamic locale route and locale provider are absent.

- [ ] **Step 3: Extract landing page and implement the two canonical public paths**

Move the presentational contents of `app/page.tsx` into
`components/landing/LandingPage.tsx` with this contract:

```ts
export default function LandingPage({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key)
  // render the existing sections using t(key) for every visible string
}
```

Implement `app/[locale]/page.tsx`:

```ts
import { notFound } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { isPublicLocale, resolveLocale } from '@/lib/i18n'

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh' }]
}

export default async function LocalizedLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isPublicLocale(locale)) notFound()
  return <LandingPage locale={resolveLocale({ publicLocale: locale })} />
}
```

Change `app/page.tsx` to `redirect('/en')`. Implement a switcher whose link is
`/${toPublicLocale(nextLocale)}`; it sets `document.cookie = 'forma_locale=<locale>; Path=/; Max-Age=31536000; SameSite=Lax'` before navigating. Preserve the current landing content and CTA destination; only text and URLs become locale aware.

Create a minimal client `LocaleProvider` with `{ locale, setLocale }` so the
authenticated shell can pass the resolved profile locale to client navigation.
Make `app/(app)/layout.tsx` async, load the current profile's
`preferred_locale`, wrap `BottomNav` in `LocaleProvider`, and use
`translate(locale, item.labelKey)` for nav labels. Keep current hrefs unchanged.

In this same slice, thread the resolved locale into the following core screens
and replace every visible static label with the listed key namespace. Dynamic
body evidence, exercise IDs, safety signal IDs, and plan selection logic remain
unchanged.

| Exact file | Required key namespace |
| --- | --- |
| `app/(app)/home/page.tsx` and `components/body-mirror/*` | `home.*`, `todayPlan.*`, `bodyMirror.*`, `checkIn.*` |
| `app/(app)/sessions/page.tsx` and `app/(app)/sessions/SessionsClient.tsx` | `sessions.*`, `difficulty.*`, `duration.*` |
| `app/(app)/progress/page.tsx` | `progress.*`, `bodyMirror.*` |
| `app/(app)/profile/page.tsx` and `components/profile/VoiceCoachingToggle.tsx` | `profile.*`, `voice.*`, `language.*`, `billing.*` |
| `components/nav/BottomNav.tsx` | `nav.*` |

Add every key from this table to both Task 1 message catalogs before replacing
the source strings. Keep values such as the user name, session count, score,
and plan duration as interpolation arguments (`{name}`, `{count}`, `{minutes}`)
to a small `formatMessage(template, values)` helper. The helper must replace
only named tokens from the passed record and leave unknown tokens unchanged;
write unit tests for this behavior in `lib/i18n/resolve.test.ts`.

- [ ] **Step 4: Run focused and browser checks**

Run: `npm test -- --test-name-pattern="bilingual public and app entry points"`  
Expected: PASS.  
Run: `npm run build`  
Expected: PASS.

Manually open `/en` and `/zh`; verify all landing text, language switcher,
sign-in CTA, and free-assessment CTA match the selected locale. Sign in with a
`zh-CN` profile and verify the four bottom labels are Chinese.

- [ ] **Step 5: Commit the route and navigation slice**

```bash
git add app/page.tsx app/'[locale]'/page.tsx 'app/(app)/layout.tsx' \
  components/landing/LandingPage.tsx components/i18n/PublicLanguageSwitcher.tsx \
  components/i18n/LocaleProvider.tsx components/nav/BottomNav.tsx \
  lib/i18n/publicPages.test.ts tsconfig.test.json
git commit -m "feat: add bilingual landing and navigation"
```

## Task 4: Localize deterministic check-in and live coaching cues without changing pose logic

**Files:**
- Create: `lib/coach/cues.ts`
- Create: `lib/coach/cues.test.ts`
- Modify: `lib/voiceCoach.ts`
- Modify: `components/body-mirror/BodyCheckInSheet.tsx`
- Modify: `app/session/[id]/page.tsx`
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes Task 1 `Locale`/messages and Task 3 `LocaleProvider`.
- Produces `getCue(locale, key, seed)` and `getSpeechVoice(locale, voices)`.
- `PoseCamera` continues to emit the same confidence/feedback keys and is not modified for model use.

- [ ] **Step 1: Write failing tests for allow-listed cue selection and language-matched voices**

```ts
// lib/coach/cues.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCue, getSpeechVoice } from './cues'

describe('localized coach cues', () => {
  it('returns an allow-listed Chinese cue and never an English fallback', () => {
    const cue = getCue('zh-CN', 'calibrate', 0)
    assert.equal(cue.key, 'calibrate')
    assert.match(cue.text, /身体|画面|镜头/)
  })

  it('uses a matching voice locale and returns null when none exists', () => {
    const chinese = getSpeechVoice('zh-CN', [{ lang: 'en-US', name: 'English' }, { lang: 'zh-CN', name: 'Chinese' }])
    assert.equal(chinese?.lang, 'zh-CN')
    assert.equal(getSpeechVoice('zh-CN', [{ lang: 'en-US', name: 'English' }]), null)
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="localized coach cues"`  
Expected: FAIL because `lib/coach/cues.ts` does not exist.

- [ ] **Step 3: Implement local cue variants and locale-aware browser speech**

Define only the current voice events as `CoachCueKey`:

```ts
export type CoachCueKey = 'calibrate' | 'exerciseStart' | 'transition' | 'finish' | 'frameBody' | 'slowDown' | 'coreReset'
```

`getCue(locale, key, seed)` must select `variants[Math.abs(seed) % variants.length]` from an in-repo catalog. Dynamic values such as exercise name, rep count, and next exercise name are interpolated into a reviewed locale-specific template, not model output.

Update `createVoiceCoach()` so `speak` accepts the existing `VoiceCue` with an
optional `locale` field. Before `speechSynthesis.speak`, select a voice from
`window.speechSynthesis.getVoices()` where `voice.lang.toLowerCase().startsWith(locale === 'zh-CN' ? 'zh' : 'en')`. If no voice matches, skip `speakAloud` and call current tone/haptic fallback. Preserve current cancellation and cooldown behavior exactly.

In `app/session/[id]/page.tsx`, select `preferred_locale` and pass
`locale={profile?.preferred_locale === 'zh-CN' ? 'zh-CN' : 'en-US'}` to
`SessionPlayer`. Replace the hard-coded spoken strings in `SessionPlayer` with
`getCue(locale, key, index)` and dynamic interpolation arguments. Leave every
pose score, tracking threshold, `qualityCue`, and `PoseCamera` callback
unchanged.

Use the typed message catalog for the visible Body Check-In title, disclaimer,
comfort labels, focus-area labels, safety signals, save states, and error. Pass
locale from the server Home page as a prop; do not infer it from the browser in
the sheet.

- [ ] **Step 4: Run focused/full tests and exercise both browser language cases**

Run: `npm test -- --test-name-pattern="localized coach cues"`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.

In a `zh-CN` test profile, start a camera session with a Chinese browser voice
installed: calibration and transition speech are Chinese. Repeat with only an
English voice installed: cue text remains Chinese and the tone/haptic fallback
fires. Repeat with `en-US` profile to verify English speech and all current
cooldowns still work.

- [ ] **Step 5: Commit the deterministic bilingual coaching slice**

```bash
git add lib/coach/cues.ts lib/coach/cues.test.ts lib/voiceCoach.ts \
  components/body-mirror/BodyCheckInSheet.tsx 'app/session/[id]/page.tsx' \
  'app/session/[id]/SessionPlayer.tsx' tsconfig.test.json
git commit -m "feat: localize deterministic coach cues"
```

## Task 5: Build validated, bilingual recap primitives with local fallbacks

**Files:**
- Create: `lib/coach/types.ts`
- Create: `lib/coach/fallbacks.ts`
- Create: `lib/coach/summaryInput.ts`
- Create: `lib/coach/validate.ts`
- Create: `lib/coach/prompt.ts`
- Create: `lib/coach/summary.test.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes `Locale` and `CoachCueKey` from Tasks 1 and 4.
- Produces `buildSummaryInput`, `fallbackSummary`, `validateSummary`, and `summaryResponseFormat` for the route in Task 6.

- [ ] **Step 1: Write failing pure-function tests for minimization, fallback, and validation**

```ts
// lib/coach/summary.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fallbackSummary } from './fallbacks'
import { buildSummaryInput } from './summaryInput'
import { validateSummary } from './validate'

describe('coach session recap', () => {
  const input = buildSummaryInput({ locale: 'zh-CN', formScore: 83, durationSeconds: 1200, exercisesCompleted: 4, skippedExercises: 0 })

  it('keeps the model payload to derived session facts', () => {
    assert.deepEqual(Object.keys(input).sort(), ['durationMinutes', 'exercisesCompleted', 'formBand', 'locale', 'skippedExercises'])
  })

  it('returns a Chinese fallback with an allowed next-focus cue', () => {
    const summary = fallbackSummary(input)
    assert.equal(summary.locale, 'zh-CN')
    assert.match(summary.headline, /完成|训练|练习/)
    assert.equal(summary.nextFocusCueKey, 'coreReset')
  })

  it('rejects advice that invents treatment or changes the plan', () => {
    assert.equal(validateSummary(input, { headline: 'Great', body: 'Take medication and train for 45 minutes tomorrow.', nextFocusCueKey: 'coreReset', tone: 'steady' }), null)
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="coach session recap"`  
Expected: FAIL because recap primitives do not exist.

- [ ] **Step 3: Implement exact recap contracts and validation gate**

```ts
// lib/coach/types.ts
import type { Locale } from '@/lib/i18n'
import type { CoachCueKey } from './cues'

export type FormBand = 'building' | 'steady' | 'strong'
export interface SessionSummaryInput {
  locale: Locale
  durationMinutes: number
  exercisesCompleted: number
  skippedExercises: number
  formBand: FormBand
}
export interface SessionSummary {
  locale: Locale
  headline: string
  body: string
  nextFocusCueKey: CoachCueKey
  tone: 'celebrate' | 'steady' | 'gentle'
}
```

`buildSummaryInput` maps `formScore >= 85` to `strong`, `>= 70` to `steady`,
otherwise `building`, and uses `Math.max(1, Math.round(durationSeconds / 60))`.
It must not accept arbitrary user text or camera data.

`validateSummary(input, value)` returns `SessionSummary | null` only when:

- `headline` and `body` are non-empty strings within 18/72 Chinese characters or 12/48 English words;
- `tone` is one of the three unions;
- `nextFocusCueKey` is in the Task 4 allow-list;
- `zh-CN` output contains at least one Han character and `en-US` output does not
  contain more Han characters than ASCII letters;
- lowercase text excludes `diagnos`, `injury`, `treatment`, `medication`, `prescribe`, `疼痛缓解`, `诊断`, `治疗`, `处方`;
- text does not include a numeral followed by `min`, `分钟`, `reps`, or `次` outside source facts.

`fallbackSummary` returns reviewed language-specific copy for each `FormBand`; it always chooses `coreReset` and never mentions a medical outcome. `prompt.ts` supplies the same JSON shape as a strict schema and instructions to use facts only, not give medical/treatment advice, and match `input.locale`.

- [ ] **Step 4: Run pure recap verification**

Run: `npm test -- --test-name-pattern="coach session recap"`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit recap primitives**

```bash
git add lib/coach/types.ts lib/coach/fallbacks.ts lib/coach/summaryInput.ts \
  lib/coach/validate.ts lib/coach/prompt.ts lib/coach/summary.test.ts tsconfig.test.json
git commit -m "feat: add safe bilingual coach recap contracts"
```

## Task 6: Add a server-only AI recap endpoint with secure record lookup and fallback

**Files:**
- Create: `lib/coach/providers/openai.ts`
- Create: `lib/coach/providers/openai.test.ts`
- Create: `app/api/coach/session-summary/route.ts`
- Create: `lib/coach/sessionSummaryRoute.test.ts`
- Modify: `tsconfig.test.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes Task 5 contracts. The route accepts `{ sessionRecordId: string }` only.
- Produces `{ summary: SessionSummary; status: 'generated' | 'fallback' | 'unavailable' }`.
- Requires `OPENAI_API_KEY` and `OPENAI_COACH_MODEL` only on the server; never prefix either with `NEXT_PUBLIC_`.

- [ ] **Step 1: Write failing adapter and route-source tests**

```ts
// lib/coach/providers/openai.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCoachResponse } from './openai'

describe('OpenAI coach adapter', () => {
  it('extracts only parsed JSON from a successful response body', () => {
    assert.deepEqual(parseCoachResponse({ output_text: '{"headline":"Nice work","body":"You moved steadily today.","nextFocusCueKey":"coreReset","tone":"steady"}' }), {
      headline: 'Nice work', body: 'You moved steadily today.', nextFocusCueKey: 'coreReset', tone: 'steady',
    })
  })
})
```

```ts
// lib/coach/sessionSummaryRoute.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('session summary route boundary', () => {
  it('loads an owned record server-side and never accepts a client score', () => {
    const source = readFileSync('app/api/coach/session-summary/route.ts', 'utf8')
    assert.match(source, /\.eq\('user_id', user\.id\)/)
    assert.match(source, /sessionRecordId/)
    assert.doesNotMatch(source, /formScore:\s*body/)
  })
})
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --test-name-pattern="OpenAI coach adapter|session summary route boundary"`  
Expected: FAIL because adapter and route are absent.

- [ ] **Step 3: Implement the server-only provider and endpoint**

Use native `fetch` in `lib/coach/providers/openai.ts`; keep the provider independent of Next request/response objects:

```ts
export async function generateCoachSummary(input: SessionSummaryInput): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_COACH_MODEL
  if (!apiKey || !model) throw new Error('Coach provider is not configured')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: buildCoachPrompt(input), text: { format: summaryResponseFormat } }),
    signal: AbortSignal.timeout(6_000),
  })
  if (!response.ok) throw new Error(`Coach provider returned ${response.status}`)
  return parseCoachResponse(await response.json())
}
```

The route must: authenticate with `createClient()`; reject invalid JSON/absent
record id with 400; select only `form_score`, `duration_seconds`,
`exercises_completed`, `skipped_exercises`, `completed_at`, and
`session_plan_id` for the owned, completed record; derive `locale` from that
user's profile; call `buildSummaryInput`; call the adapter; validate; and write
`ai_feedback`, `coach_summary_version = 'v1'`, and status only after a valid
result. Any adapter/configuration/validation failure returns and stores the
Task 5 local fallback with status `fallback` or `unavailable`; it never makes
the route fail after a valid owned record is found.

Add to `.env.example`:

```dotenv
# Server-only; no NEXT_PUBLIC_ prefix.
OPENAI_API_KEY=
OPENAI_COACH_MODEL=
```

- [ ] **Step 4: Run tests and verify no server secret reaches the browser build**

Run: `npm test -- --test-name-pattern="OpenAI coach adapter|session summary route boundary"`  
Expected: PASS.  
Run: `npm run lint`  
Expected: PASS.  
Run: `npm run build`  
Expected: PASS.

Review route source: it accepts an id only, queries `.eq('user_id', user.id)`,
and contains no `NEXT_PUBLIC_OPENAI` reference.

- [ ] **Step 5: Commit the endpoint**

```bash
git add app/api/coach/session-summary/route.ts lib/coach/providers/openai.ts \
  lib/coach/providers/openai.test.ts lib/coach/sessionSummaryRoute.test.ts \
  .env.example tsconfig.test.json
git commit -m "feat: generate validated coach session recaps"
```

## Task 7: Integrate recap replacement after session persistence and verify the full core loop

**Files:**
- Create: `lib/coach/requestSummary.ts`
- Create: `lib/coach/requestSummary.test.ts`
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Modify: `app/session/[id]/page.tsx`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes Task 6 response `{ summary, status }`.
- Produces `requestSessionSummary(sessionRecordId)` client helper and a completion UI that starts with local fallback then replaces it when the endpoint succeeds.

- [ ] **Step 1: Write failing request helper and integration-boundary tests**

```ts
// lib/coach/requestSummary.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSummaryResponse } from './requestSummary'

describe('session summary client request', () => {
  it('accepts only the expected server response shape', () => {
    assert.equal(parseSummaryResponse({ summary: { locale: 'en-US', headline: 'Nice work', body: 'You moved steadily today.', nextFocusCueKey: 'coreReset', tone: 'steady' }, status: 'generated' })?.status, 'generated')
    assert.equal(parseSummaryResponse({ status: 'generated' }), null)
  })
})
```

Add a source-level assertion that `endSession()` calls the helper only after
`assertSupabaseSuccess(result, 'Complete session')` and does not await it before
`setPhase('finished')`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="session summary client request"`  
Expected: FAIL because `requestSummary.ts` is absent.

- [ ] **Step 3: Add non-blocking recap replacement**

Implement the client helper:

```ts
export async function requestSessionSummary(sessionRecordId: string) {
  const response = await fetch('/api/coach/session-summary', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionRecordId }),
  })
  if (!response.ok) return null
  return parseSummaryResponse(await response.json())
}
```

In `SessionPlayer`, introduce `const [sessionSummary, setSessionSummary] =
useState<SessionSummary | null>(null)` and build the existing local score-band
copy before writing the record. After the record update succeeds, call
`void requestSessionSummary(recordId.current).then(result => { if (result) setSessionSummary(result.summary) })`.

The UI immediately shows the local recap in the selected language. It displays
the AI result only after it arrives and labels neither result as medical advice.
Do not retry in the player. A partial save/early exit keeps its current local
feedback and does not request an AI recap.

Extend the server page profile select/passed props only for the locale required
by the local fallback; all AI secrets remain absent from page props.

- [ ] **Step 4: Run full verification**

Run: `npm test -- --test-name-pattern="session summary client request"`  
Expected: PASS.  
Run: `npm run lint`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.  
Run: `npm run build`  
Expected: PASS.

Manual acceptance matrix:

| Case | Expected result |
| --- | --- |
| `en-US`, configured provider | English local recap appears immediately; it becomes validated English model recap without blocking finish. |
| `zh-CN`, configured provider | Chinese local recap appears immediately; it becomes validated Chinese model recap. |
| Provider unset/timed out | Training is still marked complete and the local recap remains. |
| Invalid/mixed-language provider result | API rejects it and saves/returns reviewed fallback copy. |
| Safety hold | Existing localized safety message stays deterministic; no summary changes the plan. |

- [ ] **Step 5: Commit integration**

```bash
git add lib/coach/requestSummary.ts lib/coach/requestSummary.test.ts \
  'app/session/[id]/SessionPlayer.tsx' 'app/session/[id]/page.tsx' tsconfig.test.json
git commit -m "feat: show bilingual AI coach recaps after training"
```

## Task 8: Validate release integrity and prepare the premium-voice follow-up boundary

**Files:**
- Create: `lib/coach/speechProvider.ts`
- Create: `lib/coach/speechProvider.test.ts`
- Modify: `docs/superpowers/specs/2026-07-10-bilingual-ai-coach-v1-design.md`
- Modify: `README.md`

**Interfaces:**
- Produces a type-only `SpeechProvider` seam. No cloud speech API, user billing gate, or audio storage is implemented in this task.

- [ ] **Step 1: Write the provider-boundary test**

```ts
// lib/coach/speechProvider.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SpeechProvider } from './speechProvider'

describe('speech provider boundary', () => {
  it('keeps locale and voice identity in the provider request contract', () => {
    const provider: SpeechProvider = { speak: async input => { assert.equal(input.locale, 'zh-CN') } }
    return provider.speak({ text: '轻轻收回肋骨。', locale: 'zh-CN', voiceId: 'future-premium-zh' })
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="speech provider boundary"`  
Expected: FAIL because the seam does not exist.

- [ ] **Step 3: Add the interface and document current production behavior**

```ts
// lib/coach/speechProvider.ts
import type { Locale } from '@/lib/i18n'

export interface SpeechProvider {
  speak(input: { text: string; locale: Locale; voiceId?: string }): Promise<void>
}
```

Do not instantiate this interface from `voiceCoach` yet. Its only V1 transport
remains browser SpeechSynthesis + tone/haptic fallback. Add README setup notes
for `OPENAI_API_KEY`, `OPENAI_COACH_MODEL`, the required Supabase migration,
and the fact that app restart is needed after setting server environment values.
Update the design document's status from `approved direction, ready for
implementation planning` to `implementation plan created`; do not alter its
product decisions.

- [ ] **Step 4: Run final verification**

Run: `npm run lint`  
Expected: PASS.  
Run: `npm test`  
Expected: PASS.  
Run: `npm run build`  
Expected: PASS.

Inspect `git diff --check` and manually complete the Task 7 acceptance matrix
on both `/en` and `/zh` entry paths before deployment.

- [ ] **Step 5: Commit documentation and the vendor seam**

```bash
git add lib/coach/speechProvider.ts lib/coach/speechProvider.test.ts \
  README.md docs/superpowers/specs/2026-07-10-bilingual-ai-coach-v1-design.md
git commit -m "docs: prepare bilingual coach release"
```
