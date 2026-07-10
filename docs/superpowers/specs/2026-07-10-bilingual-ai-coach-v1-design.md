# Forma bilingual AI Coach V1 — design

**Status:** approved direction, ready for implementation planning  
**Date:** 2026-07-10

## Outcome

Forma will feel like one attentive Pilates coach for both Chinese and English
users. The coach will use the user's explicitly selected language consistently
across the product, voice, and AI-written summaries, while the body model and
safety policy remain one shared, deterministic system.

The first release makes three visible improvements:

1. A new user explicitly selects `中文` or `English` during onboarding and can
   change it later in Profile.
2. The public website has shareable `/zh` and `/en` variants, with a visible
   language switcher.
3. A training session ends with a concise, natural, language-matched coach
   recap based on structured session facts—not a generic score band.

Live form cues also become bilingual and less repetitive, but they remain
locally selected phrases; an LLM is never in the frame-by-frame feedback path.

## Goals and non-goals

### Goals

- Make language a persistent user preference, never a hidden browser guess.
- Give Chinese and English users consistent UI, cue, voice, and recap language.
- Make coaching prose warmer and more specific without allowing the model to
  choose an exercise, alter a safety decision, or diagnose an injury.
- Keep camera feedback low-latency, offline-first, and low-cost.
- Establish provider seams so text and speech vendors can be changed without
  changing session logic.

### Non-goals for V1

- A free-form, always-listening voice companion.
- Sending camera frames, video, landmarks, or recordings to an LLM/TTS vendor.
- Translating historical stored reports or adding new clinical claims.
- Completing every long-form report and legacy screen in both languages. Those
  belong to the next localization pass once the core loop is proven.
- Replacing `evaluateCoaching()` or `deriveBodyMirror()` with AI.

## Product decisions

| Decision | Chosen behavior | Reason |
| --- | --- | --- |
| Initial language | Required onboarding choice: `中文` or `English` | Avoids browser-language mistakes and creates intentional coach identity. |
| Public pages | Canonical `/zh` and `/en` URLs; a switcher preserves the destination | Supports sharing, ads, and search for both audiences. |
| Signed-in product | Use the saved account locale | One stable source for UI, voice, summaries, and future messages. |
| Language changes | Profile updates take effect on the next rendered screen/session | No mixture of languages in a live session. |
| Safety / plan logic | Shared and deterministic | The same body evidence must yield the same safety decision in either language. |
| Real-time cues | Localized, allow-listed cue variants | Keeps immediate feedback reliable and affordable. |
| LLM role | Post-session recap and later low-risk explanations only | Delivers coach warmth without placing a generative model in a safety-critical loop. |

## Architecture

### 1. Locale foundation

Introduce a small internal localization layer rather than scattering
conditionals across components.

```text
Public URL (/zh or /en) ──────┐
                              ├─> locale resolver ─> localized UI + cue copy
Onboarding / profile locale ──┘                       + voice configuration

Body Mirror + Coaching Policy ─> safe structured facts ─> Coach narration API
                                                         └> localized recap
```

The canonical persisted values are:

```ts
type Locale = 'zh-CN' | 'en-US'
type PublicLocale = 'zh' | 'en'
```

`user_profiles.preferred_locale` will be a non-null constrained database
column, defaulting to `en-US` for existing accounts. A new account must choose
a locale before the rest of onboarding can finish. The selected value is also
stored in a cookie for anonymous/marketing navigation; an authenticated profile
always wins over the cookie.

Resolution order:

1. Account preference, for authenticated in-app requests.
2. Explicit public path segment, for unauthenticated public pages.
3. `forma_locale` cookie, when a path does not state it.
4. `en-US` fallback. Browser detection may preselect a choice, but it must not
   silently commit it.

`lib/i18n/` owns `Locale`, resolving, public-path mapping, message lookup, and
formatting helpers. `messages/en-US.ts` and `messages/zh-CN.ts` own short,
stable product copy. Components receive a locale/message function instead of
hard-coding a language check. The translation catalog must be typed so a missing
Chinese key fails tests rather than appearing as English in production.

The first translated inventory is the public landing page, authentication and
onboarding chrome, bottom navigation, Home, Sessions, Profile, the training
player's labels/statuses, body check-in, and session completion. Exercise and
session-plan display names use a keyed V1 catalog with an English fallback;
they are not duplicated in the database yet.

### 2. Voice and cue layer

`lib/voiceCoach.ts` remains responsible for cooldowns, interruption, tone, and
haptic fallback. It must not make network calls.

Add a locale-aware cue catalog, for example
`lib/coach/cues/{en-US,zh-CN}.ts`. Each safe cue key has two to four short
variants per locale. The session player selects one deterministically from the
allowed variants, then passes it to the existing cooldown mechanism.

Example shared key:

```text
core_reset
en-US: "Slow it down—soften your ribs back in, then continue."
zh-CN: "先慢一点，轻轻把肋骨收回来，再继续。"
```

The app reads the browser's matching locale voice for V1. If no matching voice
or speech synthesis is available, it keeps the existing tone/haptic fallback;
it never falls back to a voice in the wrong language without telling the user.

Create a `SpeechProvider` interface now, but do not make cloud TTS part of the
critical live-cue path:

```ts
interface SpeechProvider {
  speak(input: { text: string; locale: Locale; voiceId?: string }): Promise<void>
}
```

Future Pro narration can use this seam for a server-issued audio asset for a
session welcome, transition, or recap. Assets are keyed by locale, voice,
content hash, and provider version, stored in object storage, and reused. This
keeps premium voice quality possible without paying for repeated cues.

### 3. Coach narration layer

Create `lib/coach/` as the boundary between deterministic coaching facts and
generative expression:

```text
lib/coach/
  types.ts             # request/result contracts and locale types
  summaryInput.ts      # turns existing session facts into a minimal payload
  prompt.ts            # locale-specific coach style and hard rules
  validate.ts          # validates structured model result; enforces fallback
  providers/openai.ts  # server-only text generation adapter
  fallbacks.ts         # safe bilingual score/effort fallback copy
  cues/                # local, allow-listed real-time cue variants
```

V1 endpoint: `POST /api/coach/session-summary`.

It receives only authenticated, derived facts such as locale, completed
exercise names/keys, session duration, aggregate form score, per-exercise score
bands, completed reps, and current Body Mirror recommendation reason keys. It
does **not** receive raw video, images, pose landmarks, injury free text, email,
or full assessment history.

The endpoint asks the configured low-cost text model for a structured result:

```ts
type SessionSummary = {
  headline: string        // <= 12 English words or <= 18 Chinese characters
  body: string            // <= 48 English words or <= 72 Chinese characters
  nextFocusCueKey: string // one key from an allow-list supplied by the server
  tone: 'celebrate' | 'steady' | 'gentle'
}
```

Prompt rules:

- Match `zh-CN` or `en-US`; never mix languages.
- Refer only to supplied facts; do not claim pain relief, diagnosis, or a
  correction that was not observed.
- Do not prescribe a new exercise, duration, intensity, or treatment.
- Use the server-provided allowed cue key rather than inventing advice.
- Be warm, direct, non-judgmental, and concise.

The adapter must use a schema/structured-output response, validate it again at
the server, and fall back to `lib/coach/fallbacks.ts` when the request times
out, is unavailable, fails validation, or the user is not entitled to enhanced
recaps. OpenAI's current documentation covers both speech generation and
structured outputs, but the specific model ID stays in an environment variable
so it can be audited and replaced without product-code changes.

The existing `generateFeedback(score)` path in
`app/session/[id]/SessionPlayer.tsx` becomes the immediate fallback, not the
source of the visible recap. The completed session is persisted first. The
summary request happens afterwards and may replace the fallback in the UI and
`session_records.ai_feedback` only after validation.

### 4. Strict ownership boundary

| Layer | Owns | Must never own |
| --- | --- | --- |
| `PoseCamera` | Local landmark analysis, confidence, score, observation keys | LLM calls, diagnosis, personalized exercise choice |
| `evaluateCoaching()` | Safety, exclusions, modifications, preferred exercises | Human-like prose |
| `deriveBodyMirror()` | Evidence-derived state/recommendation reason keys | Generative conclusions |
| Cue catalog / `voiceCoach` | Localized words, voice selection, cooldown | Safety decision or model inference |
| Coach narration API | Recap wording and low-risk explanation | Altering the plan or safety result |

No AI-generated content can be the only delivery of a safety hold or stop
instruction. Those surfaces always use a reviewed, locale-specific deterministic
message.

## Cost, performance, and privacy guardrails

- Never call an LLM per camera frame, rep, or repeated cue.
- One optional summary request per completed session; debounce/retry once only.
- Keep a `summary_version` and a content fingerprint so duplicate completion
  submissions do not create duplicate calls.
- Cache only server-generated premium narration audio, not live corrective
  prompts. Cache key: `locale + voice + textHash + providerVersion`.
- Keep provider keys server-side. The browser calls Forma API routes only.
- Log provider latency, model/provider name, success/fallback state, and token
  counts; do not log raw health narrative or video data.
- Retain existing consent/disclaimer protections. User-facing copy says Forma
  gives fitness guidance, not diagnosis or medical care.

The appropriate future technology is a small structured-output text model for
recaps, plus a provider behind `SpeechProvider` for premium pre-rendered audio.
Realtime speech-to-speech is deliberately deferred: its continuous connection,
interruption handling, and variable output make it a poor cost/reliability fit
for camera-form feedback. OpenAI documents it as a distinct Realtime/audio
surface, which is useful for a later voice check-in—not V1's live coach loop.

Reference documentation: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [text to speech](https://developers.openai.com/api/docs/guides/text-to-speech), and [Realtime and audio](https://developers.openai.com/api/docs/guides/realtime).

## Delivery sequence

### Release A — bilingual foundation

1. Add profile locale migration and data access.
2. Add locale resolver, typed messages, language selector, and Profile control.
3. Localize the first-screen/onboarding flow and the core authenticated app
   inventory listed above.
4. Add localized cue variants and language-matched browser TTS selection.
5. Verify safety-stop text and fallback tone/haptic behavior in both locales.

### Release B — Coach recap V1

1. Add `lib/coach` contracts, bilingual fallbacks, prompt, validation, and
   server-only provider adapter.
2. Add the authenticated summary endpoint and connect it after session save.
3. Preserve the existing deterministic fallback for loading/failure states.
4. Instrument usage, latency, validation failure, and feedback fallback rate.

### Release C — optional premium voice

1. Run a short Chinese/English voice audition with the same six coach lines.
2. Choose a provider on perceived naturalness, interruption latency, commercial
   terms, and cost per cached minute—not headline price alone.
3. Render/cache only welcome and recap clips; maintain browser TTS as fallback.

### Deferred Release D — voice check-in

The user speaks a short answer such as “今天右肩有点紧”; a speech-to-text
adapter produces text, an understanding adapter maps it to the existing
`BodyCheckIn` schema, and the user confirms it before save. This still feeds
the rule engine rather than an autonomous model. It is explicitly separate from
V1.

## Failure handling

| Situation | Required behavior |
| --- | --- |
| Missing/invalid account locale | Use `en-US` and prompt the user to set a preference on the next settings visit. |
| Partial translation catalog | Test/build failure for required keys; do not silently mix languages. |
| Browser has no matching TTS voice | Display cue text and use the existing tone/haptic fallback. |
| Summary API failure/timeout | Show and store reviewed local fallback copy; training completion remains successful. |
| Invalid model output or forbidden claim | Reject it, log a non-sensitive reason code, and use fallback copy. |
| Model is unavailable | Do not retry inside the session player; use fallback and allow server observability to alert. |
| Safety hold | Deterministic localized message wins; no generated overlay can override it. |

## Verification and success measures

### Automated verification

- Unit-test locale resolution priority and public-path mappings.
- Unit-test exact message-key parity for `en-US` and `zh-CN`.
- Unit-test profile locale updates and onboarding's required-choice gate.
- Unit-test cue selection: only allowed localized text is passed to
  `voiceCoach`, and cooldown behavior is unchanged.
- Unit-test coach payload minimization, output validation, forbidden-claim
  rejection, and each bilingual fallback.
- Integration-test a completed session: record saves first, then a successful
  recap replaces the fallback; an API failure leaves a usable recap.

### Product measures

- Language-choice completion rate and subsequent language-switch rate.
- Percentage of sessions with a locale-consistent completion recap.
- Summary p95 latency, fallback rate, and cost per completed session.
- Voice-on rate, voice-off rate, and repeated-cue suppression rate.
- 7-day repeat session rate segmented by locale; do not treat a language as
  successful until its core-loop completion rate is comparable.

## Existing code touchpoints

- `app/page.tsx`, auth pages, `app/onboarding/page.tsx`, authenticated pages,
  and `components/nav/BottomNav.tsx` — localized UI rollout.
- `app/(app)/profile/page.tsx` and a new language preference control —
  persistence and change surface.
- `supabase/migrations/` — profile locale constraint/default.
- `lib/voiceCoach.ts` — locale-aware browser voice choice while retaining
  cooldown/fallback behavior.
- `components/camera/PoseCamera.tsx` and
  `app/session/[id]/SessionPlayer.tsx` — only consume localized cue keys;
  camera logic stays local.
- `lib/coachingPolicy/evaluateCoaching.ts` and
  `lib/bodyMirror/deriveBodyMirror.ts` — provide structured facts/reason keys;
  no behavior change.
- `components/body-mirror/BodyCheckInSheet.tsx` — localized selection labels;
  voice check-in is deferred.

## Open questions intentionally deferred

- The named premium TTS vendor and voice identities will be decided after a
  bilingual blind audition, so the product is not locked to a vendor before
  users hear the result.
- Whether enhanced AI recaps are a Pro benefit or a limited free preview should
  be decided from Release B usage/cost data. Safety, deterministic cues, and
  fallback feedback are available to every user.
