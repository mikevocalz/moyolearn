<!-- Mobbin pass: capture-flow — homework camera capture and page review -->
<!-- SOT: docs/pack/24-homework-capture-spec.md §3 · packages/app/features/capture -->
<!-- SOT-KEYWORDS: mobbin capture camera review rotate crop confirm retake -->

## Mobbin pass: capture-flow

| App | Link | Structural move adopted |
| --- | --- | --- |
| ABY Journal | https://mobbin.com/screens/db5577b5-8a8d-4b2b-9c46-cc631f797f14 | Place a clear close/cancel `×` in the top-left and a single, short instructional line above the capture frame. |
| Google | https://mobbin.com/screens/9c8e39a1-23fe-4f31-8d45-cda3c44e3ccc | Use a visible corner guide rectangle and a context label (`Take a photo of a homework question`) so the child knows what the camera is expecting. |
| Microsoft Outlook | https://mobbin.com/screens/f580805b-6c71-4df2-a2e4-444cfb774627 | Put the capture-mode switcher at the bottom of the frame as a one-tap segmented control; it stays out of the picture and maps to the child’s choices. |
| Starling | https://mobbin.com/screens/c2c39a5c-9ad8-4f93-b762-e1ad384f1427 | After capture, show a review screen with a concise checklist of what makes a good homework photo, then offer a single primary confirm and a secondary retake. |
| Lovi | https://mobbin.com/screens/fef2d5f1-70f6-4ace-9762-05209642bdbe | Use a numbered step indicator (`1`) and a large, bottom-anchored `Next` action to signal the multi-step journey without overwhelming the child. |
| Mercury | https://mobbin.com/screens/f6de26f5-d430-40fd-9c47-077dbc29109f | On the crop/review screen, place `Use` and `Retake` as two equally-sized bottom buttons so the destructive and confirming actions are both reachable and clearly separated. |

### Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| Google | https://mobbin.com/screens/9c8e39a1-23fe-4f31-8d45-cda3c44e3ccc | A generic `Search` mode next to `Homework` | The capture flow is scoped to homework; adding a general web-search mode creates ambiguity and exits the task. |
| Microsoft Outlook | https://mobbin.com/screens/f580805b-6c71-4df2-a2e4-444cfb774627 | Adult document taxonomies (`DOCUMENT`, `PHOTO`, `WHITEBOARD`) | Young learners need action labels (`camera`, `photo library`, `type`, `voice`), not office-product categories. |
| Lovi | https://mobbin.com/screens/fef2d5f1-70f6-4ace-9762-05209642bdbe | A rigid, numbered onboarding march | We adopt the step number but keep the context step skippable so the child is not trapped in a long sequence. |

### Query used

**Query:** "learner homework camera capture screen with thumbnail review, crop, rotate, and submit for K-12 education app"  
**Platform:** iOS  
**Task intent:** Redesigning the homework capture and OCR review flow for a K-12 AI tutoring app
