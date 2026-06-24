# Rep Feedback Loop Design

## Goal

Make live training understandable during real human testing. A user should know, within the moment of movement, whether a rep counted, why it did not count, and how to adjust position or movement quality.

## Current Problem

The app can detect tracking phases, but the feedback is too quiet and too late:

- Users cannot tell whether a rep counted without watching the small rep number.
- When a rep does not count, users do not know whether the issue is framing, movement size, return-to-start, confidence, or movement quality.
- Counted-rep voice feedback is too slow and can arrive after the user has already moved on.
- Quality issues such as uneven hips in Glute Bridge or neck strain in Chest Lift are not surfaced as coaching cues.

## Product Behavior

Live feedback will combine three signals:

1. Count status: counted, not yet, tracking blocked, or manual counting.
2. Reason: the immediate reason a rep is not counting, such as full body not visible, movement too small, or return to start needed.
3. Quality cue: a coaching correction for movements that are visible but need refinement.

The app should not make every quality issue block rep counting. Light and moderate form issues can still count while showing a correction. Severe issues that break tracking or make the rep cycle incomplete can block counting.

## UX Rules

- When a rep counts, show a strong visual confirmation immediately:
  - Center-screen `+1`
  - Rep number pulse
  - Short status copy such as `Counted`
- Voice for counted reps should be short and quick, for example `Good.` or `That counts.`
- When a rep does not count, show one actionable reason, not a vague failure:
  - `Move a little bigger`
  - `Return to start`
  - `Step back, I need your full body`
  - `Improve lighting or slow down`
- Show the rep cycle stage in plain language:
  - `Start`
  - `Move`
  - `Return`
  - `Count`
- Quality cues appear under or alongside the count status:
  - `Keep both hips level`
  - `Keep your neck long`
  - `Soften your ribs`

## Initial Quality Cues

Glute Bridge:

- Count condition: hips lift above threshold and return to start.
- Quality cues:
  - Uneven hip height: `Keep both hips level`
  - Knees collapsing inward: `Press knees forward`
  - Low-back compensation: `Lift from your glutes`

Chest Lift:

- Count condition: upper trunk curls above threshold and returns to start.
- Quality cues:
  - Neck jutting forward: `Keep your neck long`
  - Rib flare: `Soften your ribs`
  - Chin tucked too tightly: `Leave space under your chin`

## Implementation Scope

This change should stay inside the existing live session stack:

- `app/session/[id]/SessionPlayer.tsx`
- `lib/poseTracking.ts` if helper geometry is needed
- focused tests for status description and quality cue selection

Do not change the exercise database, plan ordering, Supabase schema, or camera setup flow in this patch.

## Success Criteria

- A counted rep gives immediate visual confirmation and faster voice feedback.
- A non-counted rep shows a specific next action.
- Glute Bridge can surface hip-level quality feedback.
- Chest Lift can surface neck/rib quality feedback.
- Existing lint, tests, and production build pass.
