<!-- Mobbin pass: ocr-review — text review and correction after OCR or voice -->
<!-- SOT: docs/pack/24-homework-capture-spec.md §4 · packages/app/features/capture/ocr-review.tsx -->
<!-- SOT-KEYWORDS: mobbin ocr review text correction confidence low edit rescan -->

## Mobbin pass: ocr-review

| App | Link | Structural move adopted |
| --- | --- | --- |
| Quizlet | https://mobbin.com/screens/2c66cb2e-4d24-4048-a31f-e096aebc990a | Show the scanned text inside a contained card with an explicit "Edit" affordance and two clear bottom actions (`Search` / `Rescan`). |
| Yuka | https://mobbin.com/screens/1851dbc5-378c-4cf4-90e9-b8fb4dc81340 | Put image tools (`Crop`, `Rotate`, `Validate`) on a fixed bottom toolbar so the child can fix the picture before or after reading. |
| Speechify | https://mobbin.com/screens/a68d6fbd-e5af-466a-a740-b62c86879a18 | Give the full screen to the editable text and place `Cancel` / `Save File` in the top bar; this keeps the keyboard and content visible. |
| MyFitnessPal | https://mobbin.com/screens/da83cbb7-ddcd-46ce-86bf-20eb9fc50f98 | Lead the review with a confirmation question (`Do these matches look right?`) and place two equal bottom actions (`Add Ingredient` / `Edit Ingredients`). |
| Freeform | https://mobbin.com/screens/c4d02877-3a9b-49c2-ae23-364b7ef3b2cb | Use a top page counter (`2 of 2`) and top-right `Retake` plus a bottom icon toolbar for per-page adjustments. |

### Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| Quizlet | https://mobbin.com/screens/2c66cb2e-4d24-4048-a31f-e096aebc990a | `Search` as the primary action for scanned text | The homework flow sends the text to the tutor (`Start with Natalie`), not to a general search engine. |
| Yuka | https://mobbin.com/screens/1851dbc5-378c-4cf4-90e9-b8fb4dc81340 | A single `Validate` button with no editing | We require the child to see and, when confidence is low, correct the text before it is accepted. |
| Speechify | https://mobbin.com/screens/a68d6fbd-e5af-466a-a740-b62c86879a18 | Audio playback controls in the text editor | Playback is not part of the OCR correction task and would compete with the keyboard on a small screen. |
| LINE | https://mobbin.com/screens/9cbf4142-0b66-476a-b505-ddffb2dd125f | `Select all` and translation overlays | We are not translating the homework; the child is confirming what was read in the original language. |
| MyFitnessPal | https://mobbin.com/screens/da83cbb7-ddcd-46ce-86bf-20eb9fc50f98 | A list of separate matched items to verify one by one | A photographed problem usually reads as one block; we present it as one editable field rather than a list. |
| Freeform | https://mobbin.com/screens/c4d02877-3a9b-49c2-ae23-364b7ef3b2cb | `Filters` in the image toolbar | Filters alter the photo’s appearance without helping readability; crop and rotate are sufficient. |

### Query used

**Query:** "learner OCR text review and correction screen with editable text and confidence warning"  
**Platform:** iOS  
**Task intent:** Redesigning the homework capture and OCR review flow for a K-12 AI tutoring app
