# Body Mirror Phase One Implementation Plan

**Goal:** Establish the evidence model and one Body Mirror result that drives the first Home and Progress experiences for desk workers with neck, shoulder, and back discomfort.

**Architecture:** `body_check_ins`, `movement_assessments`, and `movement_observations` remain evidence sources alongside `session_records`. A deep `lib/bodyMirror` module derives freshness, confidence-qualified dimensions, safety holds, recommendations, and supporting activity once; Home and Progress only present that result.

**Tech stack:** Next.js App Router, React, TypeScript, Supabase/Postgres RLS, Tailwind, Node test runner.

## Fixed rules

- Compare only with the user's own reliable baseline; never produce a diagnosis or universal body score.
- Ignore observations below `0.70` confidence when updating the mirror, while retaining them as evidence.
- A baseline requires all three MVP movements: side arm raise, standing roll down, and seated trunk rotation.
- Daily check-ins are fresh for 24 hours. Movement evidence is current for 14 days, aging through day 30, and stale afterward.
- Sharp pain, numbness, radiating pain, dizziness, chest pain, shortness of breath, or sudden weakness pauses exercise recommendations.
- A worse post-session body feeling selects a gentler quick recommendation next time.
- Partial sessions remain evidence but never count as completed sessions, minutes, or streak days.

## Delivery tasks

### 1. Evidence schema and access rules

- Add `supabase/migrations/007_body_mirror_phase_one.sql` with the three evidence tables, constraints, indexes, ownership-preserving foreign keys, and RLS policies.
- Seed an idempotent 4-minute `Desk Reset` session from existing upright/no-mat exercises.
- Keep `supabase/migrations/000_full_setup.sql` aligned for fresh installations.
- Add SQL contract tests covering constraints, all-table RLS, and ownership consistency.

### 2. Unified Body Mirror module

- Add `lib/bodyMirror/types.ts`, `deriveBodyMirror.ts`, `loadBodyMirror.ts`, and `index.ts`.
- Public interface: `deriveBodyMirror(evidence, { now }) => BodyMirrorResult` and `loadBodyMirrorForUser(supabase, userId, { now })`.
- Cover no data, reliable baseline, low confidence, freshness, safety stop, worsened session effect, partial-session accounting, and deterministic cross-screen consistency with failing tests first.

### 3. Home

- Replace score/streak-first content with Today’s Body, evidence freshness, a functional 15-second self check-in sheet, and recommendation reason.
- Offer the seeded quick session and an appropriate full session; move free quota/upgrade messaging below the value loop.
- Render explicit no-data, check-in-due, stale, low-confidence, safety-hold, and unavailable states.

### 4. Progress

- Make comfort, mobility, and movement control the primary cards, phrased relative to the personal baseline.
- Keep completed sessions, minutes, streak, partial attempts, and recent history as supporting evidence; remove average form score from progress.
- Reuse the same Body Mirror result and status language as Home.

### 5. Verification

- Run targeted red/green tests during implementation.
- Finish with `npm test`, `npm run lint`, `npx tsc --noEmit`, and a production build using non-secret placeholder environment values if required.
- Inspect Home and Progress at the audited 390 × 844 viewport without deploying or changing remote state.
