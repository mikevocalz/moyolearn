# Accessibility plan: parent path and headset passes

Date: 2026-11-25. Standard: WCAG 2.2 AA plus Moyo's kids overrides (learner text 7:1, learner targets ≥ 56dp, no hidden gestures, no auto-submit on learner input, feedback within 100 ms). **Every script below is NOT RUN.** Expected announcements are what the code and doc 38 §7 say should happen; the run records what actually happens.

## VoiceOver run script (iOS): parent path

Setup: iPhone, VoiceOver on, Hot dial, fresh install, study tenant. Swipe right through each screen in order; record the announced string against the expected one.

| Step | Screen | Action | Expected announcement | Result |
| --- | --- | --- | --- | --- |
| 1 | FD-01 Welcome | land | H1 "Learn it by heart." then image alt "A child working through a math problem at a kitchen table while a parent looks on" | NOT RUN |
| 2 | FD-01 | swipe to doors | "Get started, button" · "Log in, button" · "I have a code, button, For kids: enter the code from your grown-up" | NOT RUN |
| 3 | FD-03 | role choice | "radiogroup" with each `RoleChoiceCard` "radio, not selected"; select guardian → "selected" | NOT RUN |
| 4 | FD-04 | fields | "Your name, text field" · "Email, text field" · "Password, secure text field" then the rule line as `aria-describedby`: "At least 8 characters. Longer is stronger." | NOT RUN |
| 5 | FD-04 | consent box | "I agree to the Terms and Privacy Policy, and I'm 18 or older, checkbox, unchecked" (see Checkbox section) | NOT RUN |
| 6 | FD-04 | submit with bad email | focus moves to `FormErrorSummary`; "Enter a valid email, like name@example.com." via polite live region | NOT RUN |
| 7 | FD-05 | OTP | each cell "Digit n of 6"; countdown not announced per second | NOT RUN |
| 8 | FD-10 Consent | land | H1 "One more step to protect your child"; three rows read as a list of 3 | NOT RUN |
| 9 | FD-10 | attestation | "I'm this child's parent or legal guardian, and I consent, checkbox, unchecked" → double-tap → "checked" | NOT RUN |
| 10 | FD-12 Add learner | grade | "Grade, radiogroup"; each "K, radio" … "12, radio"; live band line reads after selection | NOT RUN |
| 11 | FD-13 Plan | price | "11 dollars per month after your free month" as one unit; "Maybe later, button" | NOT RUN |
| 12 | Guardian review | open | "Review already-done marks, button" → list; "{n} problems, {d} already done." announced once via polite live region | NOT RUN |
| 13 | Guardian review | toggle a mark | "Problem 3, page 2: Already done before upload, checkbox, unchecked" → double-tap → "checked"; then "Saving change…" then the count line re-announced once | NOT RUN |
| 14 | Guardian review | save failure | "Your change wasn't saved. Reload the review before trying again." then "Reload question review, button" | NOT RUN |

## TalkBack run script (Android): parent path

Same 14 steps. Differences to record:

| Step | Expected TalkBack difference | Result |
| --- | --- | --- |
| 5, 9, 13 | Material Checkbox announces "checked" / "not checked" plus the label; confirm the label is read, not only the state | NOT RUN |
| 6, 12, 13 | `accessibilityLiveRegion="polite"` fires once per change, not per render | NOT RUN |
| 7 | OTP cells announce "Digit n of 6" and not "edit box" alone | NOT RUN |

## Checkbox `label` prop: behaviour to verify on both platforms

Source read: `packages/ui/Checkbox.tsx` (native) passes `label` straight to `@expo/ui` `Checkbox` inside a `Host matchContents`; the file comment says iOS renders a SwiftUI Toggle "where a switch IS the checkbox idiom" and Android renders a Material Checkbox. `packages/ui/Checkbox.web.tsx` renders a `Pressable role="checkbox"` with `aria-checked`, `aria-label={label}`, `accessibilityState`, and a visible `Text` label.

| Platform | What to verify | Why | Result |
| --- | --- | --- | --- |
| iOS | VoiceOver reads the `label` text, then the state. A SwiftUI Toggle reads "on/off", not "checked/unchecked"; record which word is spoken, and whether "switch" or "checkbox" is the role word | A parent hearing "switch, off" for "Already done before upload" may not read it as a tick | NOT RUN |
| iOS | Double-tap toggles and `haptics.selection()` fires; `disabled` blocks the toggle and VoiceOver says "dimmed" | `onValueChange` returns early when disabled | NOT RUN |
| Android | TalkBack reads label + "checked"/"not checked"; focus lands on one node, not two | Host wrapper plus native control could expose two focusable nodes | NOT RUN |
| Web | `aria-label` duplicates the visible text; confirm screen readers read it once, not twice; Space toggles; focus ring visible on both dials | `aria-label` on a Pressable that also contains the text | NOT RUN |
| All | Label is the tap target and the row meets the band min-height (see `design-system-diff.md` on `min-h-14`) | 49dp on device today | NOT RUN |

## Headset passes

Source: `docs/design/hands-input-handoff.md` "Accessibility and action parity". Device: Quest 3S first, PICO 4 Ultra second (roster device pass).

### One-handed pass

| Check | Expected | Result |
| --- | --- | --- |
| Every tray action with the right hand only, then the left hand only | identical outcome; no two-hand confirmation anywhere | NOT RUN |
| Hold a pen stroke, rest the other hand in view | second hand does not take the stroke | NOT RUN |
| Rest 30 s mid-session with both hands down | tool and session state unchanged on return | NOT RUN |
| Clear and exit confirmations | reachable and dismissible with one hand; no wrist rotation required | NOT RUN |

### Left-handed pass

| Check | Expected | Result |
| --- | --- | --- |
| Tray under the paper (`boardTrayGrid`) reached from the left | no key occluded by the writing hand; Undo stays visible while a colour is picked | NOT RUN |
| Rail at `railYawDeg` +40 on the left wing | not inside the left hand's writing path; if it is, record the yaw at which it clears | NOT RUN |
| Coach card Skip / Next | both keys reachable without crossing the body midline | NOT RUN |

### Captions

| Rule | Expected | Result |
| --- | --- | --- |
| Placement | captions sit below the paper, above the tray, never over ink; `spatialType.body` floor | NOT RUN |
| Persistence | captions remain readable after playback ends until dismissed | NOT RUN |
| Contrast | caption plate meets 7:1 against passthrough and against the board | NOT RUN |
| Not audio-only | every state (listening, tracking lost, saved) has a visible text form | NOT RUN |

### Tremor and non-standard reach

No diagnosis-dependent mode. Record stroke success at the 20 mm and 25 mm safety depths for the children in `user-research-plan.md` who show visible tremor; larger band targets and hysteresis are the only adjustments permitted.

## Verdict

NOT RUN. No PR for these screens opens until the two parent-path runs and the three headset passes have results with zero critical or major findings.
