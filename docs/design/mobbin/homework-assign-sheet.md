<!-- Mobbin pass: homework-assign-sheet — "Upload work for <child>", the guardian's door into capture -->
<!-- SOT: packages/app/features/homework/guardian-assign-sheet.tsx · packages/ui/BottomSheet.tsx · packages/ui/adaptive-panes/use-window-size-class.ts -->
<!-- SOT-KEYWORDS: mobbin assign sheet upload work child bottom sheet anchored panel size class -->

## Mobbin pass: homework assign sheet

Archetype: **Confirm-then-go sheet**. One trigger, "Upload work for Maya". It opens a short surface that names the child again, says what will happen in one sentence, and offers one filled action. Compact windows get the kit `BottomSheet`; medium and wider get a panel anchored under the trigger beside the switcher.

### Purpose

The only mistake this entry can make is saving a sibling's worksheet under the wrong name. So the surface exists to make the parent read the child's name twice before the camera opens, and to say where the pages will go. It does not pick a source (camera, library, PDF); that is CaptureScreen's first stage and already exists.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| Alan | Send us a quote (sheet) | https://mobbin.com/screens/f4b7f39d-a244-4ed9-a544-d91838b00566 | Short sheet over the explanatory page: close affordance, then `Take a photo · Choose a photo · Choose a file` as plain rows. The page behind stays readable. |
| Notion | Insert Media | https://mobbin.com/screens/2f99a08e-bb58-450d-87d3-b4c7a4073e82 | Titled sheet, four rows, system-standard. Cited for the row grammar. |
| Etsy (web) | Account menu | https://mobbin.com/screens/0c6dce7f-4bea-44df-bccc-d516dc87221d | On a wide window the account actions open as a panel anchored under the trigger in the header, not as a modal over the page. |
| GetYourGuide (web) | Profile panel | https://mobbin.com/screens/2fb73c82-5b1a-48c5-84ed-9edda27c319d | Anchored panel with a title, grouped rows and a hairline divider; the page behind is not dimmed. |
| Docusign | Add Documents | https://mobbin.com/screens/9e9d3cbf-0ee5-463c-bb7f-ecbf18f1e3c1 | Seven circular source icons (Scan, Photos, Files, Google, OneDrive, Box, Dropbox). Cited for the refusal. |
| Perplexity | Options sheet | https://mobbin.com/screens/d7220e78-7231-4822-ab69-169c863deff9 | Source tiles plus a `47 uploads remaining this month` quota line. Cited for the refusal. |
| Revolut Business | Upload file | https://mobbin.com/screens/320a330f-abf0-4bdf-8a3b-50c5df4f4fb8 | A warning line (`don't attach your full card number`) above the source rows. Cited for the "say what happens" sentence, refused for the tone. |

### Take

- **Keep the page behind it readable.** Alan leaves the quote page visible behind a short sheet (https://mobbin.com/screens/f4b7f39d-a244-4ed9-a544-d91838b00566), and Notion's Insert Media sheet sits over the File page it adds to (https://mobbin.com/screens/2f99a08e-bb58-450d-87d3-b4c7a4073e82). The kit `BottomSheet` snaps at 55% and 85%, never full screen, so the switcher and the timeline stay in view.
- **Anchor on wide windows.** Etsy and GetYourGuide open the account actions as a panel under the trigger (https://mobbin.com/screens/0c6dce7f-4bea-44df-bccc-d516dc87221d, https://mobbin.com/screens/2fb73c82-5b1a-48c5-84ed-9edda27c319d). From `medium` up the sheet becomes a 352dp (22rem) panel, placed from the button's `measureInWindow` box inside a transparent react-native `Modal`, with a click-away layer and no dimming, so the two-pane feed is not covered by a phone-shaped sheet.
- **Say what will happen in one sentence.** Revolut's warning line (https://mobbin.com/screens/320a330f-abf0-4bdf-8a3b-50c5df4f4fb8) is the right slot and the wrong voice. Moyo's line is "Take photos of the pages or import a PDF. You'll check what was read before anything is saved. Then Maya starts question one with Natalie." The earlier draft ended "on their own device"; the flow does not require a second device, so the claim was cut.
- **Name the child twice.** The trigger says it, the title says it, and an avatar row inside the surface says it a third time with "This worksheet will be saved to Maya's record." Three readings before the camera.
- **One filled action.** `Choose pages` is the only `primary` button; `Not now` is `ghost`.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| Docusign (https://mobbin.com/screens/9e9d3cbf-0ee5-463c-bb7f-ecbf18f1e3c1) | Seven source icons including cloud drives | Source choice belongs to CaptureScreen stage 1, which already offers camera, photos, file, type and voice. Duplicating it here would be two choosers for one job. |
| Perplexity (https://mobbin.com/screens/d7220e78-7231-4822-ab69-169c863deff9) | `47 uploads remaining this month` | No quota, streak or usage line on a family surface. |
| Notion (https://mobbin.com/screens/2f99a08e-bb58-450d-87d3-b4c7a4073e82) | `Scan Document` as a separate row from `Take photo` | One camera path. The guided frame does the scanning job inside capture. |
| Revolut Business (same screen) | Dark warning register | The sentence says what happens, in the guardian voice, not what not to do. |
| Any | A full-screen sheet | The kit sheet's snap points are 0.55 and 0.85 by design; the feed stays visible. |

### Mapping to Moyo tokens

| Slot | Token / class |
| --- | --- |
| Trigger | `Button variant="outline"`, `aria-expanded`, `aria-haspopup="dialog"` |
| Compact surface | `@acme/ui` `BottomSheet` (`rounded-t-sheet bg-surface-raised px-4 pb-6`) |
| Anchored panel | `absolute top-full mt-2 w-[22rem] max-w-[90vw] rounded-card border-2 border-border bg-surface-raised p-inset shadow-card` |
| Panel title | `font-display text-xl font-semibold text-text` (same slot as `SheetSurface.title`) |
| Close | 44pt `min-h-11 min-w-11 rounded-md bg-surface-sunken` |
| Child row | `Avatar size="md"` (44pt) + `text-base font-semibold` + `text-sm text-text-muted` |
| Actions | `Button` primary + `Button variant="ghost"`, `gap-stack` |

### Open questions for the design critique

1. **Panel width on `medium`.** 22rem is a guess that fits beside a 2-chip switcher at 600dp; at 3 or more chips the trigger wraps under the row and the panel anchors lower. Should the panel anchor to the switcher row instead of the button?
2. **Fold posture.** On a vertical hinge the panel, placed from the trigger's left edge, could straddle the fold when the trigger sits near it. `AdaptivePanes` has the fold geometry (`useFoldLayouts`); the panel does not read it yet.
3. **Tab trap.** Resolved in code: the panel is a react-native `Modal`, and react-native-web's `ModalFocusTrap` brackets Tab inside it, closes on Escape through `onRequestClose`, and restores focus to the trigger on close. Not yet verified with a screen reader on a device; see the b3 log.
