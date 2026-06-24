# Rep Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live training explain whether a rep counted, why a rep did not count, and how the user should adjust position or movement quality.

**Architecture:** Keep the existing `SessionPlayer` state machine as the source of truth. Add a small feedback model around it: rep cycle labels, stronger counted feedback, faster counted voice, and lightweight per-exercise quality cues for Glute Bridge and Chest Lift.

**Tech Stack:** Next.js App Router, React client components, Node test runner, TypeScript.

## Global Constraints

- Do not change the exercise database, plan ordering, Supabase schema, or camera setup flow.
- Do not make every quality issue block rep counting.
- Counted rep feedback must be immediate and visibly stronger than the current small toast.
- Non-counted feedback must show one actionable reason.
- Glute Bridge must support hip-level quality feedback.
- Chest Lift must support neck/rib quality feedback.
- Existing lint, tests, and production build must pass.

---

## File Structure

- Modify `app/session/[id]/SessionPlayer.tsx`: add feedback model, quality cue helpers, stronger UI confirmation, and shorter voice behavior.
- Create `lib/repFeedback.test.ts`: source-level and pure-helper tests for rep feedback behavior if helpers are exported or moved.
- Prefer keeping helpers inside `SessionPlayer.tsx` unless testability requires exporting small pure functions. If exporting helpers, place them in `lib/repFeedback.ts`.

---

### Task 1: Rep Feedback Copy And Voice Timing

**Files:**
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Test: `lib/repFeedback.test.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Consumes: existing `describeAiRepStatus(phase, detail, movementStale)`
- Produces: clearer status copy and shorter counted-rep voice cue

- [ ] **Step 1: Write the failing test**

Create `lib/repFeedback.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('session rep feedback copy', () => {
  const source = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')

  it('uses short immediate counted-rep voice copy', () => {
    assert.match(source, /text:\s*'Good\.'/)
    assert.match(source, /cooldownMs:\s*0/)
    assert.doesNotMatch(source, /Nice, rep counted/)
    assert.doesNotMatch(source, /cooldownMs:\s*26_000/)
  })

  it('uses actionable not-counted messages', () => {
    assert.match(source, /Move a little bigger/)
    assert.match(source, /Return to start/)
    assert.match(source, /Step back, I need your full body/)
    assert.match(source, /Improve lighting or slow down/)
  })
})
```

Add the test to `tsconfig.test.json` include list:

```json
"lib/repFeedback.test.ts"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --test-name-pattern "session rep feedback copy"
```

Expected: FAIL because the current source still contains `Nice, rep counted`, `cooldownMs: 26_000`, and older vague messages.

- [ ] **Step 3: Implement minimal copy and voice update**

In `describeAiRepStatus`:

```ts
case 'waiting_for_full_body':
case 'tracking_lost': {
  const isLost = phase === 'tracking_lost'
  if (detail === 'upper-body') {
    return {
      chip: 'Step back',
      tone: 'attention',
      message: 'Step back, I need your full body.',
      voice: { key: 'upper-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
    }
  }
  if (detail === 'low-confidence') {
    return {
      chip: 'Low confidence',
      tone: 'attention',
      message: 'Improve lighting or slow down.',
      voice: { key: 'tracking-low-confidence', text: 'Improve lighting or slow down.', cooldownMs: 8_000 },
    }
  }
  return {
    chip: isLost ? 'Tracking lost' : 'Full body needed',
    tone: 'attention',
    message: 'Step back, I need your full body.',
    voice: { key: 'full-body', text: 'Step back, I need your full body.', cooldownMs: 8_000 },
  }
}
```

For movement stale:

```ts
message: 'Move a little bigger.',
voice: { key: 'movement-stale', text: 'Move a little bigger.', cooldownMs: 8_000 },
```

For return phase:

```ts
chip: 'Return to start',
message: 'Return to start.',
voice: { key: 'return-phase', text: 'Return to start.', cooldownMs: 4_000 },
```

For counted phase:

```ts
chip: 'Counted +1',
message: 'Counted.',
voice: { key: `rep-counted-${Date.now()}`, text: 'Good.', cooldownMs: 0 },
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --test-name-pattern "session rep feedback copy"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/session/[id]/SessionPlayer.tsx lib/repFeedback.test.ts tsconfig.test.json
git commit -m "fix: tighten live rep feedback copy"
```

---

### Task 2: Rep Cycle Stage UI

**Files:**
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Test: `lib/repFeedback.test.ts`

**Interfaces:**
- Consumes: `aiRepPhase`
- Produces: visual cycle labels `Start`, `Move`, `Return`, `Count`

- [ ] **Step 1: Write the failing test**

Append to `lib/repFeedback.test.ts`:

```ts
it('renders the rep cycle stage labels', () => {
  assert.match(source, /Start/)
  assert.match(source, /Move/)
  assert.match(source, /Return/)
  assert.match(source, /Count/)
  assert.match(source, /repCycleStage/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --test-name-pattern "renders the rep cycle stage labels"
```

Expected: FAIL because `repCycleStage` does not exist yet.

- [ ] **Step 3: Implement the cycle stage helper**

Add near `describeAiRepStatus`:

```ts
type RepCycleStage = 'Start' | 'Move' | 'Return' | 'Count'

function repCycleStage(phase: AiRepPhase): RepCycleStage {
  if (phase === 'waiting_for_return_phase') return 'Return'
  if (phase === 'rep_counted') return 'Count'
  if (phase === 'waiting_for_engaged_phase') return 'Move'
  return 'Start'
}
```

Inside `SessionPlayer`, derive:

```ts
const cycleStage = repCycleStage(aiRepPhase)
```

Render near the existing AI status line:

```tsx
<div className="grid grid-cols-4 gap-1" aria-label="Rep cycle">
  {(['Start', 'Move', 'Return', 'Count'] as const).map(stage => (
    <div
      key={stage}
      className={`h-1.5 rounded-full ${cycleStage === stage ? 'bg-sage-light' : 'bg-white/15'}`}
      aria-label={stage}
    />
  ))}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --test-name-pattern "renders the rep cycle stage labels"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/session/[id]/SessionPlayer.tsx lib/repFeedback.test.ts
git commit -m "feat: show rep cycle stage"
```

---

### Task 3: Quality Cue Model For Glute Bridge And Chest Lift

**Files:**
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Test: `lib/repFeedback.test.ts`

**Interfaces:**
- Consumes: pose landmarks from `processAutoRep`
- Produces: `qualityCue` state string shown in UI and optionally spoken after counted reps

- [ ] **Step 1: Write the failing test**

Append to `lib/repFeedback.test.ts`:

```ts
it('contains initial Glute Bridge and Chest Lift quality cues', () => {
  assert.match(source, /qualityCue/)
  assert.match(source, /Keep both hips level/)
  assert.match(source, /Press knees forward/)
  assert.match(source, /Lift from your glutes/)
  assert.match(source, /Keep your neck long/)
  assert.match(source, /Soften your ribs/)
  assert.match(source, /Leave space under your chin/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --test-name-pattern "contains initial Glute Bridge and Chest Lift quality cues"
```

Expected: FAIL because no quality cue model exists.

- [ ] **Step 3: Add quality cue state and helper**

Inside `SessionPlayer` state:

```ts
const [qualityCue, setQualityCue] = useState<string | null>(null)
```

Reset it when exercise changes:

```ts
setQualityCue(null)
```

Add helper near the AI status helpers:

```ts
function detectQualityCue(exerciseName: string | undefined, landmarks: any[]): string | null {
  if (!exerciseName || !landmarks?.length) return null

  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const leftKnee = landmarks[25]
  const rightKnee = landmarks[26]
  const leftEar = landmarks[7]
  const rightEar = landmarks[8]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]

  if (exerciseName === 'Glute Bridge') {
    if (leftHip && rightHip && Math.abs(leftHip.y - rightHip.y) > 0.045) return 'Keep both hips level'
    if (leftKnee && rightKnee && leftHip && rightHip && Math.abs(leftKnee.x - rightKnee.x) < Math.abs(leftHip.x - rightHip.x) * 0.65) return 'Press knees forward'
    if (leftShoulder && rightShoulder && leftHip && rightHip) return 'Lift from your glutes'
  }

  if (exerciseName === 'Chest Lift') {
    if (leftEar && leftShoulder && Math.abs(leftEar.x - leftShoulder.x) > 0.12) return 'Keep your neck long'
    if (rightEar && rightShoulder && Math.abs(rightEar.x - rightShoulder.x) > 0.12) return 'Keep your neck long'
    if (leftShoulder && rightShoulder && leftHip && rightHip && Math.abs(leftShoulder.y - leftHip.y) < 0.18) return 'Soften your ribs'
    return 'Leave space under your chin'
  }

  return null
}
```

Inside `processAutoRep`, after landmarks are confirmed usable:

```ts
const nextQualityCue = detectQualityCue(exercisesRef.current[currentExRef.current]?.exercise?.name, lm)
if (nextQualityCue) setQualityCue(nextQualityCue)
```

- [ ] **Step 4: Render quality cue**

Near the AI status message:

```tsx
{qualityCue && (
  <p className="px-1 text-[13px] leading-snug text-sage-light" aria-live="polite">
    {qualityCue}
  </p>
)}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- --test-name-pattern "contains initial Glute Bridge and Chest Lift quality cues"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/session/[id]/SessionPlayer.tsx lib/repFeedback.test.ts
git commit -m "feat: add initial form quality cues"
```

---

### Task 4: Strong Counted Rep Visual Feedback

**Files:**
- Modify: `app/session/[id]/SessionPlayer.tsx`
- Test: `lib/repFeedback.test.ts`

**Interfaces:**
- Consumes: existing `repFlash`
- Produces: stronger center-screen `+1` pulse and longer visible confirmation

- [ ] **Step 1: Write the failing test**

Append to `lib/repFeedback.test.ts`:

```ts
it('shows a strong center-screen counted rep confirmation', () => {
  assert.match(source, /\+1/)
  assert.match(source, /rep-pulse/)
  assert.match(source, /REP_COUNTED_DISPLAY_MS\s*=\s*800/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --test-name-pattern "strong center-screen counted rep confirmation"
```

Expected: FAIL because `rep-pulse` does not exist and display timing is currently `1100`.

- [ ] **Step 3: Update display timing and center pulse**

Change:

```ts
const REP_COUNTED_DISPLAY_MS = 800
```

Render inside the active camera overlay:

```tsx
{repFlash && (
  <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
    <div className="rep-pulse rounded-full bg-sage-light/90 px-8 py-5 text-5xl font-bold text-white shadow-[0_0_40px_rgba(122,158,142,.45)]">
      +1
    </div>
  </div>
)}
```

If CSS animation does not already exist, add inline Tailwind animation classes only if supported by current config. Otherwise use existing transition classes and avoid modifying global CSS.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --test-name-pattern "strong center-screen counted rep confirmation"
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run lint
npm test
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy STRIPE_PRO_YEARLY_PRICE_ID=price_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/session/[id]/SessionPlayer.tsx lib/repFeedback.test.ts
git commit -m "feat: emphasize counted rep feedback"
```

---

## Self-Review

- Spec coverage: Tasks cover immediate counted feedback, non-counted reasons, cycle stage, Glute Bridge quality cues, Chest Lift quality cues, and verification.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `qualityCue`, `repCycleStage`, and `detectQualityCue` are introduced before use.
