# Forma Body Assessment Conversion and Living Report Design

## Decision

Forma will turn the existing movement assessment into a free acquisition experience and make the continuously adapting body report the core subscription value.

The approved funnel is:

1. A guest completes a short, choice-first intake.
2. Safety rules determine whether standard, modified, or no camera assessment is appropriate.
3. The guest completes three movement observations in about 90 seconds.
4. Forma reveals one reliable, personalized insight before registration.
5. Registration saves the body baseline and opens a useful free report preview.
6. A personalized subscription card unlocks the training path, ongoing adaptation, reassessment, and report history.
7. A first personalized five-minute session is available before payment details are requested.

This design extends the existing Body Mirror and `/assessment` work. It supersedes only the prior account-first acquisition sequence and minimal completion result. Existing camera confidence, evidence persistence, safety-hold, and no-diagnosis rules remain in force.

## Product goal

The free assessment must create a credible moment of recognition: “Forma noticed something specific about how I move and connected it to my context.” The subscription must then answer the more valuable question: “What should I do next, and how will that change as my body changes?”

The product is for sedentary office workers with common neck, shoulder, and back discomfort. It is a general wellness and movement-coaching product, not a diagnostic or treatment product.

## Success criteria

- A typical guest completes intake in 45–60 seconds without typing.
- A standard camera assessment takes about 90 seconds after setup.
- The first insight appears before account creation.
- Every visible conclusion cites questionnaire context, movement evidence, or both.
- Safety information is always free and never hidden by registration or subscription.
- Low-confidence, partial, or self-report-only attempts do not create numeric movement conclusions.
- Paid value is framed as an adapting plan and living report, not merely more data.
- Home, Progress, Session, and reports consume the same Body Mirror evidence and safety policy.

## Approaches considered

### Account-first assessment

This is simplest to persist but asks for commitment before the user experiences value. It is rejected as the primary acquisition flow. Existing signed-in users can still launch reassessments directly.

### Fully anonymous report

This minimizes friction but makes sensitive-data handling, recovery, and longitudinal history difficult. It is rejected.

### Guest assessment with insight-before-registration — selected

The guest grants explicit assessment consent, completes the intake and camera flow in an ephemeral session, and sees one insight. Registration then persists the structured intake and observations. This balances conversion, trust, and implementation complexity.

## End-to-end experience

### 1. Entry

The primary promise is outcome-led:

> In four minutes, learn what kind of movement fits your body today.

Supporting copy states that the experience combines body history, habits, and three movements; produces a free preview; and does not require immediate subscription.

The primary action is **Start my free body assessment**.

### 2. Consent and privacy

Before collecting sensitive context or opening the camera, Forma explains:

- raw camera video is not stored by default;
- only derived movement observations are retained after registration;
- health and injury answers can be viewed, exported, or deleted;
- the experience does not provide medical diagnosis;
- the user can stop at any time.

Guest answers remain ephemeral until registration. Registration includes explicit consent to save them to the account.

### 3. Choice-first intake

The intake is presented as one large card per question, with the promise **6 quick choices · about 45 seconds · no typing required**. The stages read **Get to know you → Prepare assessment → Build report**, rather than showing a clinical question count.

#### Primary goal

Select up to two:

- ease neck and shoulder tension;
- make the lower back feel better;
- reduce stiffness from sitting;
- improve mobility;
- build core strength;
- create a consistent movement habit.

#### Current body focus

Select one or more regions: neck/shoulders, upper back, lower back, hips, knees, or no particular discomfort. When a region is selected, choose one sensation: tight, achy, painful, or numb/radiating.

#### Injury history

Choose none, previous but recovered, or still affects movement. Only the latter two reveal region and current status: recovered, occasionally noticeable, or still in treatment/recovery.

#### Movement habit

Choose rarely, once per week, two to three times per week, or four or more times per week. Exercise type is optional and does not block continuation.

#### Work pattern

Choose sitting under four hours, four to eight hours, over eight hours, or mostly standing/moving.

#### Available time

Choose 5, 15, or 30 minutes.

#### Safety confirmation

One separate card asks whether the user currently has worsening or sharp pain, numbness/radiating symptoms, dizziness, or a professional instruction to pause exercise. The choices are **None of these** and **One or more applies**.

The exact screening language and deterministic decision rules require review by an appropriately qualified movement-health professional before production release.

### 4. Safety and assessment routing

The screening engine produces three internal outcomes:

- `standard`: run the normal three movements;
- `modified`: reduce range, substitute, or skip a relevant movement;
- `stop`: save or retain the safety context, do not begin camera assessment, show conservative free guidance, and never show a paywall in this state.

An old injury alone does not create a stop state. Current symptom behavior and explicit restrictions drive routing.

### 5. Movement assessment

Each movement follows the same interaction:

1. automatic framing confirmation;
2. one short visual demonstration;
3. two valid repetitions;
4. one-tap response: comfortable, a little tight, or uncomfortable;
5. automatic advance.

#### Side-view standing arm raise

May observe arm-elevation range, torso-lean proxy, elbow extension, movement smoothness, symptom response, and capture confidence. It must not claim shoulder pathology or posture diagnosis. A relevant unilateral shoulder history can add an optional short single-arm comparison.

#### Side-view Standing Roll Down

May observe overall forward-bend excursion, descent and return control, knee-flexion proxy, hip displacement, speed, symptom response, and confidence. It must not claim segmental spinal mobility from a two-dimensional pose estimate.

#### Front-view seated trunk rotation

May observe a rotation proxy, relative left-right difference, pelvic displacement, return control, symptom response, and confidence. It must not present the proxy as a clinically precise rotation angle.

Every applicable observation is represented through:

- `range`;
- `symmetry`, only when supportable;
- `control`;
- `symptom_response`;
- `confidence`.

The initial assessment establishes the user’s personal reference. Later progress compares the same metric under comparable setup conditions. Forma does not create a universal body score.

### 6. First insight before registration

Forma reveals only the most reliable conclusion, for example:

> We noticed that you use more torso lean while raising your arms. Because you sit for long periods, shoulder mobility and trunk control will be the first areas your plan explores.

The page then offers **Save my body starting point and view my report**. Price and subscription language do not appear before this value moment.

### 7. Free report preview

After registration, the preview contains:

- report date, evidence completeness, and freshness;
- a short “your body story” paragraph connecting goals, habits, and relevant history;
- one relative strength;
- one or two priority observations;
- one recommended training direction;
- complete safety information;
- confidence and evidence-source disclosure;
- suggested reassessment timing.

If evidence is insufficient, the report says so and offers a retry. It never fills an empty slot with generic praise or fabricated movement data.

### 8. Subscription boundary

The report shows personalized locked chapter titles rather than a generic feature list:

- your first two-week training path;
- movement changes for the relevant injury history;
- recommended weekly schedule;
- five-minute office resets;
- reassessment metrics and plan-change history.

The embedded subscription card appears after the free insight cards. Its promise is:

> Your plan is ready. Start with the movement priorities found today, then let Forma adjust the plan from each session and reassessment.

The four paid benefits are daily personalized training, context-aware movement alternatives, two-week reassessment, and an evolving report. At this point the primary action is **Try my first five-minute session**; the user can also choose **Continue with free**. This card previews subscription value but does not request payment details yet.

### 9. First session and trial

The user can complete one recommended five-minute session before payment details are requested. Its post-session check-in demonstrates the adaptation loop. After that value moment, Forma offers **Start my seven-day trial**, requests payment details, and takes the user directly into the current plan after successful checkout.

## Living report and retention

### Per visit

A five-second body check-in asks which area needs attention today. It offers a 3–5 minute quick session and a 15–30 minute full session with a visible recommendation reason. A daily camera reassessment is not required.

### Per session

The post-session check-in records better, unchanged, or worse. Forma may adjust the next session’s intensity or movement choice and explains why. A single check-in can modify today’s plan, but does not rewrite long-term conclusions.

### Weekly

When enough evidence exists, the weekly summary reports comfort trends, effective training, plan adjustments, and next priority. When evidence is sparse, it says there is not enough information yet.

### Every two weeks

Forma invites a 90-second reassessment using the same movements and comparable camera setup. Reliable changes can create a new report version and change the current stage goal.

### Every four weeks

The monthly review summarizes comfort, mobility proxies, movement control, consistency, and plan changes. It states observation, evidence, and confidence without claiming medical causation.

### Change policy

- One body check-in may change today’s intensity.
- Repeated worse responses trigger a regression or movement substitution.
- A high-confidence reassessment may update a Body Mirror dimension.
- A new stop signal immediately applies the existing safety hold.
- Major stage-goal changes require reliable reassessment or explicit user-context change.
- Every plan change exposes a plain-language reason.

### Notifications

Only three reminder classes are in scope: the user-selected body check-in time, a new weekly/monthly report, and a due reassessment. Forma does not threaten lost streaks. Missing a day produces a low-pressure quick-session invitation.

### Cancellation

Cancellation never removes the user’s body history. The user retains access to the free report, safety information, prior report versions, export, deletion, and limited free training. New adaptive plans, automatic substitutions, and new paid reports pause. Resubscription resumes from the existing history.

## Architecture

### Guest assessment state

A guest-flow controller owns consent, choice answers, assessment routing, camera observations, and recovery. Before registration, data is held only in an ephemeral browser session and is not treated as durable Body Mirror evidence. Raw video is not uploaded or stored.

After registration and explicit save consent, the controller persists the structured intake, assessment record, and confidence-qualified observations as one transaction or a recoverable staged operation. If persistence fails, it retains the guest state locally long enough to retry and does not claim the report was saved.

### Screening policy module

A deterministic module transforms intake answers into:

- `safety_state`;
- `movement_constraints`;
- `plan_preferences`;
- `report_context`.

The UI, report writer, and language model never independently reimplement stop rules.

### Movement observation module

The existing assessment domain remains the only boundary between MediaPipe samples and normalized movement evidence. It owns stable metric keys, confidence, rejection, and personal-baseline comparison.

### Report composer

The report composer consumes normalized intake, Body Mirror evidence, assessment freshness, session effects, and plan state. It produces a structured report model containing visible claims, evidence references, confidence, free/paid visibility, and change reasons.

A language model may rewrite approved structured claims into warm prose. It may not create diagnoses, remove restrictions, invent observations, choose safety state, or select exercises outside the deterministic plan policy.

### Plan policy

The plan policy maps safety state, movement constraints, preferences, available time, recent session effects, and current plan stage to allowed, modified, excluded, and preferred exercises. Home, Session, and the report consume this same output.

## Data model

This feature builds on existing `body_check_ins`, `movement_assessments`, `movement_observations`, and `session_records`.

Add or formalize:

- `health_intake_versions`: immutable questionnaire snapshots, consent version, derived screening outcome, constraints, preferences, and timestamp;
- `body_report_versions`: immutable structured report output, evidence references, confidence, free/paid visibility, change summary, and generation timestamp;
- current-plan state or versioning sufficient to explain what changed and why.

Derived reports are not a competing source of truth. They reference the underlying evidence and can be regenerated. Historical versions remain available for comparison and audit.

All user-specific rows require user-scoped access controls. Sensitive answers must be minimized, encrypted in transit and at rest through the platform’s supported controls, exportable, and deletable according to the product’s privacy policy and launch jurisdictions.

## Error and edge behavior

- Camera permission denied: offer retry or self-report; do not create numeric movement evidence.
- Low confidence: explain framing needs, offer retry, and do not update the Body Mirror.
- Partial assessment: retain resumable guest state; do not call it complete.
- Guest closes the browser: make no promise of durable saving.
- Registration succeeds but evidence save fails: show a retry state and preserve the staged payload.
- Stop signal: end the assessment, show free guidance, and suppress subscription prompts.
- Post-session response is worse: record it, avoid celebration copy, and regress the next recommendation when policy thresholds are met.
- Evidence is stale: show age and invite reassessment instead of presenting old conclusions as current.
- Report generation fails: keep the evidence, show a recoverable generation error, and do not fall back to invented generic text.

## Visual and interaction direction

The experience extends Forma’s cream background, sage and rose palette, serif display type, rounded cards, and calm motion language.

- One large question per screen with thumb-reachable controls.
- Choice cards use icon-library icons, text labels, visible selected borders, and filled states; selection is never color-only.
- Rose indicates attention or action, not pathology or danger by default.
- Report content reads as a vertical body story rather than a clinical lab sheet.
- Data provenance and confidence use quieter sans-serif text below each conclusion.
- No red crosses, universal score gauges, fear-based warnings, countdown paywalls, or streak-loss threats.
- Motion must respect reduced-motion preferences and never delay advancing through the intake.

## Analytics

Track the funnel without storing raw sensitive answers in event payloads:

- assessment entry to consent;
- consent to intake completion;
- intake to camera start;
- camera start to assessment completion;
- first insight to registration;
- registration to report preview;
- preview to first personalized session;
- first session to trial start;
- two sessions within seven days;
- two-week reassessment completion;
- monthly report view and subscription renewal.

Events may include broad flow state and failure category, but not injury details, symptom text, raw landmarks, or video.

## Testing

### Domain tests

- Every intake branch maps deterministically to standard, modified, or stop.
- An old, recovered injury alone does not cause a stop.
- Stop outcomes cannot be overridden by report or plan generation.
- Partial, self-report, stale, and low-confidence evidence cannot create numeric conclusions.
- Report claims reference existing evidence and respect free/paid visibility.
- Plan changes follow the approved per-visit, repeated-response, and reassessment thresholds.
- Cancellation preserves history while pausing paid generation.

### Integration tests

- Guest state survives normal navigation and transfers only after account consent.
- Failed account transfer is retryable without duplicate assessments.
- The first insight renders before registration and no price appears on that screen.
- Stop state suppresses camera capture and all paywall UI.
- Successful registration opens the free report preview.
- One free personalized session precedes the trial prompt.
- Home, Progress, Session, and reports reflect the same safety state and Body Mirror evidence.

### Browser and accessibility checks

- Complete the standard path using selection only and verify the 45–60 second intake target.
- Verify recovered-injury, active-symptom, stop, camera-denied, low-confidence, partial-exit, retry, registration-failure, and cancellation paths.
- Verify mobile reachability, keyboard operation, focus order, selected states, screen-reader labels, contrast, and reduced motion.

## Product safeguards

- Never diagnose, name a suspected pathology, or claim treatment.
- Never sell through fear or hide safety guidance behind payment.
- Never present two-dimensional proxies as clinical measurements.
- Never imply causation from a small number of sessions.
- Never upload or retain raw guest video by default.
- Never allow a language model to decide safety or silently remove a restriction.

## Rollout

### Phase 1: acquisition and preview

Ship the choice-first intake, guest assessment, first insight, registration transfer, free preview, and one free personalized session. Report prose can initially use deterministic templates over structured claims.

### Phase 2: subscription adaptation

Add the two-week plan, post-session adjustment, report versions, reassessment invitations, weekly summary, and paid report sections.

### Phase 3: higher-trust service

Consider optional professional review as a separate higher-priced offering only after the self-serve safety and report system is validated.

## Out of scope

- Medical diagnosis, treatment, or rehabilitation claims.
- A universal body score or population ranking.
- Daily camera assessment.
- Raw video storage or human review by default.
- A full-body clinical screening battery.
- Professional-review operations in the initial release.
- Changes unrelated to assessment, Body Mirror, reports, plans, or subscription conversion.
