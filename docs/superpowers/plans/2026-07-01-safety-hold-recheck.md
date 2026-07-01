# Safety Hold Recheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show why movement is paused and let a newer safe self check-in clear an accidentally triggered safety hold.

**Architecture:** Keep `deriveBodyMirror` as the sole safety source. Add one presentation helper for readable signal labels, prove newest-check-in clearing behavior in domain tests, and let Home render the existing `BodyCheckInSheet` while paused.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Node test runner.

## Global Constraints

- Preserve all historical `body_check_ins`; never update or delete the triggering row.
- Do not automatically expire safety signals.
- Session continues to consume `deriveSessionBodyPolicy` without a second safety calculation.
- Reuse Forma's existing rose safety card and `BodyCheckInSheet`.

---

### Task 1: Safety recovery domain contract and readable labels

**Files:**
- Create: `lib/bodyMirror/safetySignals.ts`
- Create: `lib/bodyMirror/safetySignals.test.ts`
- Modify: `lib/bodyMirror/deriveBodyMirror.test.ts`
- Modify: `lib/bodyMirror/index.ts`
- Modify: `tsconfig.test.json`

**Interfaces:**
- Produces: `formatSafetySignals(signals: SafetySignal[]): string`
- Preserves: `deriveBodyMirror(evidence).safety.shouldPause` derives only from the newest check-in.

- [ ] **Step 1: Write failing tests**

Add a domain test with an older `sharp_pain` check-in and a newer check-in whose `safetySignals` is empty; assert the result is not `safety_hold`, `shouldPause` is false, and the input still contains both rows. Add label tests expecting `Sharp pain` and `Radiating pain and numbness`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: label tests fail because `formatSafetySignals` does not exist; the recovery assertion documents existing newest-row behavior.

- [ ] **Step 3: Implement the label helper**

Create a total mapping for all seven `SafetySignal` keys and format one, two, or multiple labels with readable conjunctions. Export it from `lib/bodyMirror/index.ts` and include the test in `tsconfig.test.json`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`

Expected: all domain and label tests pass.

---

### Task 2: Home pause explanation and retake action

**Files:**
- Modify: `lib/bodyMirror/bodyMirrorPages.test.ts`
- Modify: `app/(app)/home/page.tsx`

**Interfaces:**
- Consumes: `formatSafetySignals(signals)` and `BodyMirrorResult.safety.signals`.
- Produces: paused Home card with `Triggered by: …` and `Retake safety check-in`.

- [ ] **Step 1: Write the failing Home contract test**

Assert Home passes `bodyMirror.safety.signals` to `RecommendationActions`, calls `formatSafetySignals`, and renders `Retake safety check-in` through `BodyCheckInSheet` when `mode === 'pause'`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: Home contract fails because pause currently returns `null`.

- [ ] **Step 3: Implement the minimal Home recovery UI**

Import `SafetySignal` and `formatSafetySignals`, pass signals into `RecommendationActions`, and replace the pause early return with a rose-tinted trigger summary plus the existing sheet button. Do not alter Session policy or persistence.

- [ ] **Step 4: Run complete verification**

Run: `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, and the production build with non-secret test environment values.

Expected: all commands exit successfully.

- [ ] **Step 5: Commit**

Stage only the plan's files and commit with `fix: allow safety hold recheck`.
