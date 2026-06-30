# Body Mirror Deep Sage Card Design

## Goal

Replace the near-black Today’s Body card with a visibly green, ink-rich sage treatment. The card should remain Home’s strongest visual anchor while feeling botanical and native to Forma rather than like a black monitoring dashboard.

## Visual direction

Use a deep sage surface with a restrained vertical gradient from `#3F5F54` to `#527368`. Keep the existing Lora/Inter typography, rounded shape, information order, icons, and status semantics.

- Card: ink-rich sage gradient, subtle light edge, and a soft green-toned shadow.
- Heading and row titles: warm cream rather than pure white.
- Eyebrow and supporting text: pale sage-white `#DCE8E1` for readable small text.
- Icon tiles: translucent warm white with cream icons.
- Dividers: quiet translucent warm white.
- Default top-right status chip: translucent warm white with cream text.
- Dimension state chips: keep their existing semantic colors; the no-data chip remains warm cream with muted sage text.
- Safety status: retain rose styling so it remains unmistakable.
- Freshness metadata: pale sage-white with adequate contrast.

The signature element is the clearly green dark surface: it should feel confident, calm, and botanical, never black, blue, glossy, or overly saturated.

## Scope

Change only the Home Today’s Body card and the compact rendering of `BodyMirrorDimensions` used inside it. Do not change Progress, the check-in sheet, domain behavior, copy, data handling, spacing, or the broader design system.

## Responsive and accessibility requirements

Preserve the current mobile-first layout, tap targets, semantic structure, and focus behavior. Text, icons, chips, and dividers must remain readable in no-data, baseline, improving, steady, declined, safety-hold, and load-error states.

## Verification

- Run the existing tests, lint, typecheck, and production build.
- Inspect Home at mobile width in the no-data state.
- Confirm the card is Home’s strongest visual anchor while remaining visibly sage rather than near-black.
- Confirm rose safety states and all compact dimension status chips remain distinguishable.
