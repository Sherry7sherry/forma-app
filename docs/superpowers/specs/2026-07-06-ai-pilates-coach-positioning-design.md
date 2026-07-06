# AI Pilates Coach Positioning Design

## Summary

Reposition Forma from a generic movement or body mirror product into an **AI Pilates Coach that learns the user's body**. The positioning must stay broad enough for both users who want to replace offline Pilates and users who already attend studios and want supplemental support.

The first implementation should be mostly information architecture and copy. It should make the existing product feel more like a personalized coach service without adding large new data models, new camera capabilities, or a separate design system.

## Approved product direction

Primary positioning:

> An AI Pilates coach that learns your body.

Supporting explanation:

> Start with a quick body assessment. Forma turns your body history, daily check-ins, and AI movement observations into personalized Pilates sessions that adapt as your body changes.

The product should communicate:

- AI Pilates coach, not generic fitness app.
- Personalized for the user's body, not a static class library.
- Useful as either a primary at-home Pilates coach or a companion to offline Pilates.
- Focused on comfort, mobility, and control, not a universal body score.
- Safety-aware, non-diagnostic, and grounded in the existing Body Mirror evidence model.

Do not use **between-class coach** as the main product position. That is a valid use case, but too narrow for users who want Forma to replace offline training.

## Navigation model

Keep the bottom app navigation simple:

- Home
- Sessions
- Progress
- Profile

Do not add the four positioning modules as bottom tabs. They belong on the public landing page and selected logged-in cards, not the global app nav.

## Public landing page

The public landing page should sell the new position in this sequence:

1. Hero: clear AI Pilates Coach positioning.
2. App preview: show "Today’s Body" and "Today’s Plan" as the core app experience.
3. How it personalizes: four concise cards explaining the loop.
4. Differentiation: not a generic Pilates class library.
5. CTA: start free body assessment.

Recommended hero content:

- Badge: `AI Pilates Coach`
- Title: `An AI Pilates coach that learns your body.`
- Subtitle: `Start with a quick body assessment. Forma turns your body history, daily check-ins, and AI movement observations into personalized Pilates sessions that adapt as your body changes.`
- Primary CTA: `Start my free body assessment`
- Secondary CTA: `See how Forma personalizes`
- Helper: `About four minutes · No mat · No account needed to start`

The "How it works" section should become "How Forma personalizes". Use four short cards or steps, not long tabs:

1. `Body assessment` — `Quick movement check + body history.`
2. `Today’s plan` — `A session matched to how you feel now.`
3. `AI coaching` — `Real-time cues as you practice.`
4. `Body progress` — `Track comfort, mobility, and control.`

The wording must be compact enough for mobile. Avoid long paragraphs inside cards.

## Logged-in Home

Logged-in Home should not explain the product from scratch. It should serve the user.

Current Home already has:

- Today’s Body
- Recommended today
- check-in
- free-session quota

Update the framing to make the recommendation feel like a coach plan:

- Keep `Today’s Body`.
- Rename the recommendation label from `Recommended today` to `Today’s Plan`.
- Let the plan still use existing Body Mirror recommendation modes: baseline, check-in, quick, full, reassess, pause.
- Keep the existing safety hold behavior and do not add urgency or paywalling around safety.
- Keep quota information demoted.

The app preview on the public page may also use `Today’s Plan` to mirror the logged-in Home experience.

## Sessions

Sessions should feel like a smart training library, not a generic exercise catalog.

First-pass filter labels:

- All
- Quick Reset
- Full Practice
- Recovery
- Strength
- Mobility
- Core

If the existing data cannot support exact filtering for `Quick Reset` and `Full Practice`, map them by duration in the client:

- Quick Reset: duration less than or equal to 8 minutes.
- Full Practice: duration greater than or equal to 15 minutes.

Keep existing exercise/session data. Do not seed new sessions for this copy pass unless the implementer finds a very small missing case that breaks the UI.

Header:

- Title: `Sessions`
- Subtitle: `Pilates sessions matched to your body and your day.`

## Profile upgrade banner

The upgrade banner currently says:

> AI camera, unlimited sessions, advanced tracking.

Change the value proposition to the approved paid reasons:

- personalized AI Pilates plans;
- unlimited sessions;
- AI form feedback;
- living body report updates;
- body pattern insights.

Suggested copy:

- Eyebrow: `Personalized coaching`
- Title: `Upgrade to Forma Pro`
- Body: `Unlock unlimited personalized Pilates, AI form feedback, living body report updates, and body pattern insights.`

Keep the existing billing buttons and pricing.

## Body Report and Progress

Do not rename the bottom nav `Progress`.

The current Body Report and Progress foundation is already aligned with the direction. In this implementation pass, only make small copy improvements if needed:

- Use `Living Body Report` as paid/value language where appropriate.
- Keep the report non-diagnostic.
- Keep progress framed around comfort, mobility, and control.

Do not add a coach-facing or instructor-facing report as a primary module. If referenced, use the broader name `Body Snapshot`, but this should not be part of the first implementation pass unless it is only copy.

## Non-goals for this pass

- No new bottom tabs.
- No instructor-only module.
- No new database tables.
- No new LLM dependency.
- No broad rewrite of Body Mirror, assessment, or session player logic.
- No new medical claims.
- No long text blocks inside mobile cards.

## Acceptance criteria

- The public landing page clearly says Forma is an AI Pilates coach personalized to the user's body.
- The public landing page explains personalization through four compact modules, not tabs.
- Logged-in Home emphasizes `Today’s Plan`.
- Sessions uses smarter, user-facing categories.
- Profile upgrade copy communicates paid value beyond unlimited sessions.
- Bottom navigation remains unchanged.
- Safety and non-diagnostic boundaries remain intact.
- Existing visual system remains intact: cream/sage/rose palette, rounded cards, serif headings, mobile-first layout.
