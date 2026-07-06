# AI Pilates Coach Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition Forma's user-facing product surfaces as an AI Pilates coach that learns the user's body, without changing the core Body Mirror or billing architecture.

**Architecture:** This is a copy and information-architecture pass over existing Next.js pages. Keep current routing, Supabase data access, Stripe buttons, Body Mirror recommendation logic, and bottom navigation. Add only small local helpers where a page needs a clearer presentation model, especially for session filters.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Supabase, Stripe checkout, existing lucide-react icons.

## Global Constraints

- Primary positioning must be: `An AI Pilates coach that learns your body.`
- Public landing badge must be: `AI Pilates Coach`.
- Do not use `between-class coach` as the main product position.
- Keep bottom nav as Home, Sessions, Progress, Profile.
- Do not add new bottom tabs.
- Keep safety guidance free and non-paywalled.
- Keep non-diagnostic language intact.
- Do not add database tables, LLM calls, or new subscription logic in this pass.
- Keep existing cream/sage/rose visual system, rounded cards, serif headings, and mobile-first layout.

---

## File Structure

- Modify `app/page.tsx`: update landing hero, preview labels, how-it-works section, feature cards, final CTA copy.
- Modify `app/(app)/home/page.tsx`: rename recommendation framing to `Today’s Plan`; keep existing recommendation modes and actions.
- Modify `app/(app)/sessions/SessionsClient.tsx`: update header and filters; add local filter matching for Quick Reset and Full Practice based on duration.
- Modify `app/(app)/profile/page.tsx`: update upgrade banner copy only; preserve billing buttons and account controls.
- Modify or add tests under `lib/*test.ts`: current project uses source-contract tests for page copy and behavior. Add tests that read page source and assert the new positioning copy and nav constraints.

---

### Task 1: Landing page positioning and compact personalization modules

**Files:**
- Modify: `app/page.tsx`
- Test: `lib/aiPilatesPositioning.test.ts`

**Interfaces:**
- Consumes: existing public route `/`, existing CTA route `/body-assessment`.
- Produces: public landing page with approved AI Pilates Coach positioning and four compact personalization modules.

- [ ] **Step 1: Write the failing source-contract test**

Create `lib/aiPilatesPositioning.test.ts` with:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

const landing = readFileSync('app/page.tsx', 'utf8')
const home = readFileSync('app/(app)/home/page.tsx', 'utf8')
const sessions = readFileSync('app/(app)/sessions/SessionsClient.tsx', 'utf8')
const profile = readFileSync('app/(app)/profile/page.tsx', 'utf8')
const bottomNav = readFileSync('components/nav/BottomNav.tsx', 'utf8')

describe('AI Pilates Coach positioning', () => {
  it('uses the approved public landing hero positioning', () => {
    assert.match(landing, /AI Pilates Coach/)
    assert.match(landing, /An AI Pilates coach that learns your body\./)
    assert.match(landing, /Start with a quick body assessment/)
    assert.match(landing, /personalized Pilates sessions that adapt as your body changes/)
    assert.match(landing, /See how Forma personalizes/)
  })

  it('explains personalization through compact modules, not bottom tabs', () => {
    for (const label of ['Body assessment', 'Today’s plan', 'AI coaching', 'Body progress']) {
      assert.match(landing, new RegExp(label))
    }
    assert.doesNotMatch(bottomNav, /Body assessment|Today’s plan|AI coaching|Body progress/)
  })

  it('keeps logged-in home focused on today rather than product education', () => {
    assert.match(home, /Today’s Body/)
    assert.match(home, /Today’s Plan/)
    assert.doesNotMatch(home, /How Forma personalizes/)
  })

  it('frames sessions as a smart Pilates library', () => {
    for (const label of ['Quick Reset', 'Full Practice', 'Recovery', 'Strength', 'Mobility', 'Core']) {
      assert.match(sessions, new RegExp(label))
    }
    assert.match(sessions, /Pilates sessions matched to your body and your day\./)
  })

  it('sells Pro as personalized coaching, not only unlimited access', () => {
    assert.match(profile, /Personalized coaching/)
    assert.match(profile, /Upgrade to Forma Pro/)
    assert.match(profile, /living body report updates/)
    assert.match(profile, /body pattern insights/)
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- --test-name-pattern="AI Pilates Coach positioning"
```

Expected: FAIL because the current source still uses `Personal Body Mirror`, `Recommended today`, old filters, and old Pro copy.

- [ ] **Step 3: Update landing hero copy**

In `app/page.tsx`, change the hero badge, title, subtitle, and secondary CTA to:

```tsx
<div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/20
                rounded-full px-4 py-1.5 text-xs font-semibold text-sage-dark
                mb-6 uppercase tracking-widest">
  AI Pilates Coach
</div>
<h1 className="font-serif text-4xl sm:text-5xl font-medium text-charcoal
               leading-tight mb-5">
  An AI Pilates coach that learns your body.
</h1>
<p className="text-charcoal-mid text-lg leading-relaxed mb-8 max-w-md mx-auto">
  Start with a quick body assessment. Forma turns your body history, daily check-ins, and AI movement observations into personalized Pilates sessions that adapt as your body changes.
</p>
```

Keep the primary CTA as `Start my free body assessment`. Change the secondary CTA text to:

```tsx
See how Forma personalizes
```

Keep the helper text:

```tsx
About four minutes · No mat · No account needed to start
```

- [ ] **Step 4: Update landing app preview labels**

In the fake phone preview in `app/page.tsx`, change:

```tsx
Today's session
```

to:

```tsx
Today's plan
```

Change the preview session title to a more personalized plan:

```tsx
Spinal Mobility & Deep Core
```

may remain, but the surrounding copy should imply plan adaptation. If editing the stats row, prefer:

```tsx
[['Today','Plan'],['Body','Mirror'],['Living','Report']]
```

- [ ] **Step 5: Replace the how-it-works section with compact personalization modules**

In `app/page.tsx`, keep the same section anchor `id="how-it-works"` for the secondary CTA. Change the eyebrow, heading, and mapped card data to:

```tsx
<p className="text-xs font-semibold text-sage uppercase tracking-widest text-center mb-2">How Forma personalizes</p>
<h2 className="font-serif text-3xl text-charcoal text-center mb-10">
  Built around your body, not a generic class library.
</h2>
```

Use these four steps:

```tsx
[
  { num: '01', title: 'Body assessment', desc: 'Quick movement check + body history.' },
  { num: '02', title: 'Today’s plan', desc: 'A session matched to how you feel now.' },
  { num: '03', title: 'AI coaching', desc: 'Real-time cues as you practice.' },
  { num: '04', title: 'Body progress', desc: 'Track comfort, mobility, and control.' },
]
```

- [ ] **Step 6: Update feature section copy without adding new capabilities**

In `app/page.tsx`, change feature heading from `Built for recovery` to:

```tsx
Personalized coaching
```

Change the section title to:

```tsx
More than a Pilates video library
```

Keep feature cards grounded in existing capabilities. Suggested cards:

```tsx
[
  { emoji: '📷', title: 'AI movement feedback', desc: 'Camera-supported cues help you adjust as you move.' },
  { emoji: '🧭', title: 'Today’s plan', desc: 'Short resets or full sessions based on your current body state.' },
  { emoji: '🧍‍♀️', title: 'Body-aware training', desc: 'Sessions adapt around comfort, mobility, and control.' },
  { emoji: '📈', title: 'Living body report', desc: 'See changes compared with your own baseline.' },
  { emoji: '🎯', title: 'Personalized focus', desc: 'Plans reflect your goals, habits, and focus areas.' },
  { emoji: '🌿', title: 'Safety-aware guidance', desc: 'Movement pauses or softens when your body signals caution.' },
]
```

- [ ] **Step 7: Update final CTA copy**

In `app/page.tsx`, keep the final CTA route `/body-assessment`, but change title/body to:

```tsx
Ready for Pilates that fits your body?
```

and:

```tsx
Start with one free assessment and see the first insight before creating your full plan.
```

- [ ] **Step 8: Run the positioning test**

Run:

```bash
npm test -- --test-name-pattern="AI Pilates Coach positioning"
```

Expected: PASS for landing-related assertions; if later assertions still fail, continue to the next tasks.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx lib/aiPilatesPositioning.test.ts
git commit -m "feat: reposition landing as ai pilates coach"
```

---

### Task 2: Logged-in Home Today’s Plan framing

**Files:**
- Modify: `app/(app)/home/page.tsx`
- Test: `lib/aiPilatesPositioning.test.ts`

**Interfaces:**
- Consumes: existing `bodyMirror.recommendation` object and `RecommendationActions`.
- Produces: logged-in Home that frames the recommendation as `Today’s Plan`.

- [ ] **Step 1: Confirm the existing failing assertion**

Run:

```bash
npm test -- --test-name-pattern="keeps logged-in home"
```

Expected before implementation: FAIL if `Today’s Plan` is not present.

- [ ] **Step 2: Rename recommendation label**

In `app/(app)/home/page.tsx`, change:

```tsx
Recommended today
```

to:

```tsx
Today’s Plan
```

Keep the existing `Sparkles` and `AlertTriangle` states. Do not change `bodyMirror.recommendation.title`, `bodyMirror.recommendation.reason`, or the action modes.

- [ ] **Step 3: Keep quota demoted**

Do not move the free-session quota above Today’s Body or Today’s Plan. Leave the quota aside at the bottom of the Home content. If copy is touched, prefer:

```tsx
{sessionsLeft} of 3 free sessions left this week
```

- [ ] **Step 4: Run the Home assertion**

Run:

```bash
npm test -- --test-name-pattern="keeps logged-in home"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'app/(app)/home/page.tsx' lib/aiPilatesPositioning.test.ts
git commit -m "feat: frame home recommendation as todays plan"
```

---

### Task 3: Sessions smart library filters

**Files:**
- Modify: `app/(app)/sessions/SessionsClient.tsx`
- Test: `lib/aiPilatesPositioning.test.ts`

**Interfaces:**
- Consumes: existing `plans` array with `duration_minutes`, `goals`, `category`, and `focus_areas`.
- Produces: client-side filters that support user-facing categories without requiring schema changes.

- [ ] **Step 1: Confirm the existing failing assertion**

Run:

```bash
npm test -- --test-name-pattern="frames sessions"
```

Expected before implementation: FAIL if `Quick Reset`, `Full Practice`, or the new subtitle are missing.

- [ ] **Step 2: Update filter labels**

In `app/(app)/sessions/SessionsClient.tsx`, replace:

```ts
const FILTERS = ['All', 'Recovery', 'Strength', 'Flexibility', 'Alignment', 'Core']
```

with:

```ts
const FILTERS = ['All', 'Quick Reset', 'Full Practice', 'Recovery', 'Strength', 'Mobility', 'Core']
```

- [ ] **Step 3: Add a local filter helper**

Above `export default function SessionsClient`, add:

```ts
function matchesFilter(plan: any, filter: string): boolean {
  if (filter === 'All') return true
  if (filter === 'Quick Reset') return Number(plan.duration_minutes ?? 0) <= 8
  if (filter === 'Full Practice') return Number(plan.duration_minutes ?? 0) >= 15

  const normalized = filter.toLowerCase()
  return (
    plan.goals?.some((goal: string) => goal.includes(normalized)) ||
    plan.category?.includes(normalized) ||
    plan.focus_areas?.some((area: string) => area.includes(normalized))
  )
}
```

- [ ] **Step 4: Use the helper**

Replace the existing `filtered` calculation with:

```ts
const filtered = plans.filter(plan => matchesFilter(plan, filter))
```

- [ ] **Step 5: Update Sessions subtitle**

Change:

```tsx
Pilates-based movement, built for you.
```

to:

```tsx
Pilates sessions matched to your body and your day.
```

- [ ] **Step 6: Run the Sessions assertion**

Run:

```bash
npm test -- --test-name-pattern="frames sessions"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'app/(app)/sessions/SessionsClient.tsx' lib/aiPilatesPositioning.test.ts
git commit -m "feat: reframe sessions as smart pilates library"
```

---

### Task 4: Profile upgrade value proposition

**Files:**
- Modify: `app/(app)/profile/page.tsx`
- Test: `lib/aiPilatesPositioning.test.ts`

**Interfaces:**
- Consumes: existing `UpgradeButton` monthly/yearly checkout flows.
- Produces: Pro upgrade banner that sells personalized coaching value, not only unlimited access.

- [ ] **Step 1: Confirm the existing failing assertion**

Run:

```bash
npm test -- --test-name-pattern="sells Pro"
```

Expected before implementation: FAIL if new upgrade copy is missing.

- [ ] **Step 2: Update upgrade banner copy**

In `app/(app)/profile/page.tsx`, change the upgrade banner eyebrow/title/body to:

```tsx
<div className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-1">
  Personalized coaching
</div>
<h3 className="font-serif text-xl text-white mb-1">Upgrade to Forma Pro</h3>
<p className="text-white/75 text-xs mb-4">
  Unlock unlimited personalized Pilates, AI form feedback, living body report updates, and body pattern insights.
</p>
```

Keep both existing `UpgradeButton` components and prices unchanged.

- [ ] **Step 3: Run the Pro assertion**

Run:

```bash
npm test -- --test-name-pattern="sells Pro"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add 'app/(app)/profile/page.tsx' lib/aiPilatesPositioning.test.ts
git commit -m "feat: update pro upgrade positioning"
```

---

### Task 5: Full verification and visual QA

**Files:**
- Verify: `app/page.tsx`
- Verify: `app/(app)/home/page.tsx`
- Verify: `app/(app)/sessions/SessionsClient.tsx`
- Verify: `app/(app)/profile/page.tsx`
- Verify: `components/nav/BottomNav.tsx`

**Interfaces:**
- Consumes: all prior task changes.
- Produces: verified, mobile-safe positioning pass.

- [ ] **Step 1: Run source contract tests**

Run:

```bash
npm test -- --test-name-pattern="AI Pilates Coach positioning"
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript/build check**

Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy STRIPE_PRO_YEARLY_PRICE_ID=price_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
```

Expected: PASS.

- [ ] **Step 5: Run diff hygiene**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 6: Browser QA**

Use the in-app browser or local dev server to inspect at mobile width:

- `/` landing hero: badge, title, subtitle, CTA, and four compact personalization modules fit without feeling like long tabs.
- `/home`: Today’s Body appears before Today’s Plan; quota remains demoted.
- `/sessions`: filter chips wrap without horizontal clipping; Quick Reset and Full Practice are visible.
- `/profile`: upgrade banner copy fits and billing buttons still work visually.

Do not accept a screenshot-only check if text is visibly cramped, cropped, or overflowing.

- [ ] **Step 7: Final commit if any verification-only fixes were needed**

If Task 5 required visual or lint fixes:

```bash
git add app/page.tsx 'app/(app)/home/page.tsx' 'app/(app)/sessions/SessionsClient.tsx' 'app/(app)/profile/page.tsx' lib/aiPilatesPositioning.test.ts
git commit -m "fix: polish ai pilates positioning qa"
```

If no changes were needed, do not create an empty commit.
