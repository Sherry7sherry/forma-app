# Safety Hold Recheck Design

## Goal

Let a user recover from an accidentally selected stop signal without weakening Forma's safety boundary or deleting evidence.

## Approved behavior

- The Home safety-hold recommendation names the stop signal or signals from the latest body check-in in plain language.
- The safety-hold card offers one primary recovery action: **Retake safety check-in**.
- The action opens the existing 15-second body check-in UI; it does not start the camera movement assessment.
- Saving a newer check-in with no stop signals immediately clears the safety hold because Body Mirror derives safety only from the latest check-in.
- Saving a newer check-in with any stop signal keeps the safety hold active.
- Previous check-ins remain unchanged as historical evidence.
- Stop signals do not expire automatically and cannot be deleted from this flow.

## Architecture and data flow

`deriveBodyMirror` remains the single source of truth. It continues to expose `result.safety.signals` and `result.safety.shouldPause` from the newest `body_check_ins` row. Home passes those signals to a small presentation helper that maps stable database keys to readable labels. `RecommendationActions` renders the existing `BodyCheckInSheet` in safety-hold mode and refreshes Home after a successful save through the sheet's existing router refresh behavior.

Session behavior is unchanged: `deriveSessionBodyPolicy` continues to hard-block while `shouldPause` is true and allows normal policy evaluation after a newer safe check-in clears it.

## UI

The existing rose safety card remains. Its reason text includes the readable trigger list, followed by the existing conservative stop guidance. The recovery button uses the existing primary button and sheet components, preserving Forma's typography, color, radius, and interaction language.

## Error handling

If saving the new check-in fails, the sheet keeps the current safety hold and shows its existing save error. No optimistic clearing occurs.

## Tests

- Body Mirror keeps a hold when the newest check-in contains a stop signal.
- A newer check-in with an empty stop-signal list clears an older hold while retaining the older evidence.
- Home safety-hold state renders readable trigger labels and the retake action.
- Session remains blocked before the clearing check-in and becomes eligible afterward through the same derived Body Mirror result.

## Out of scope

- automatic expiry of safety signals
- deleting or editing historical check-ins
- medical interpretation or diagnosis
- changes to movement assessment confidence or scoring
