# Body Mirror Soft Card Design

## Goal

Replace the near-black Today’s Body card with a lighter treatment that feels native to Forma’s cream-and-sage interface. The card must still read as the primary Home element without looking like a separate monitoring dashboard.

## Visual direction

Use a misty sage surface with a quiet vertical gradient from `#EDF3EF` to `#E3ECE7`. Keep the existing Lora/Inter typography, rounded shape, information order, icons, and status semantics.

- Card: pale sage gradient, subtle `sage/25` border, softer low-contrast shadow.
- Heading and body: charcoal and charcoal-mid instead of white.
- Eyebrow: sage-dark.
- Icon tiles: translucent white with sage-dark icons.
- Dividers: muted sage rather than white.
- Default status chip: white or cream with sage-dark text.
- Safety status: retain rose styling so it remains unmistakable.
- Freshness metadata: muted charcoal with adequate contrast.

The signature element is the fog-like sage gradient: it should feel calm and bodily, not glossy or decorative.

## Scope

Change only the Home Today’s Body card and the compact rendering of `BodyMirrorDimensions` used inside it. Do not change Progress, the check-in sheet, domain behavior, copy, data handling, spacing, or the broader design system.

## Responsive and accessibility requirements

Preserve the current mobile-first layout, tap targets, semantic structure, and focus behavior. Text, icons, chips, and dividers must remain readable in no-data, baseline, improving, steady, declined, safety-hold, and load-error states.

## Verification

- Run the existing tests, lint, typecheck, and production build.
- Inspect Home at mobile width in the no-data state.
- Confirm the card remains visually primary while blending with the cream page.
- Confirm rose safety states and all compact dimension status chips remain distinguishable.
