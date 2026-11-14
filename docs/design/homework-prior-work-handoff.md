# Homework prior-work handoff

Date: 2026-11-14. Scope: guardian-selected marks, automatic detection OFF. This is an implementation handoff and desk review, not user research or device acceptance.

## Parent handover brief

The build prompt supplies three situations to design for: a half-finished sheet, printed material mixed with handwriting, and a multi-page packet. No parents or children were interviewed in this pass. The following are testable assumptions, not observed behavior:

- A parent may want the child to continue unfinished work without transcribing every completed answer. Keep the existing subject/capture/confirmed-question route and add one reversible mark per problem.
- A visible answer or teacher annotation does not establish that a child completed a problem. Automatic marks are disabled; the parent chooses the mark after reviewing the question and available source evidence.
- Page-local numbers may repeat. Keep page and original problem number beside the question; derive counts from stable question IDs rather than displayed numbers.
- A parent may discover a mistaken tick. Support correction before start. Do not promise mid-session editing until the server defines a between-problems revision boundary.
- A packet may include an unreadable page. Keep failed page identity and retry that page; never silently treat missing extraction as an empty worksheet.

Research still needed: observe parents handing over each packet type, ask them to explain what the mark means, and observe correcting an accidental tick. Include screen-reader/large-text use. Record misunderstanding of “already done” separately from correctness judgments. Recruit and consent through the existing process; do not introduce image retention for this study.

## Existing contracts to extend

`capture-screen.tsx:startWithNatalie` in `packages/app/features/capture/` submits confirmed text with `crop: null`. `worksheet-questions.ts:extractWorksheetQuestions` has page/source numbers without stored question crops. Native `read-attachment.native.ts:readAttachmentEvidence` and web `ocr-web.ts:readHomework` are OCR seams, not prior-work classifiers. No automatic completion confidence threshold is approved. There is no evaluation dataset or precision result from this pass.

`packages/app/features/homework/homework.service.ts:reviseQuestionFor` is a transcription revision seam; do not reuse its caller-supplied author as proof of guardian authority. `apps/web/lib/homework.repository.ts:advanceSubmission` owns the locked cursor transaction. The data owner must return server-authoritative mark state and eligibility; UI must not implement a second cursor or infer eligibility from `startedAt`.

Product rule: `complete` prior work means the parent marked it as finished before tutoring. It never means correct, verified, solved independently, or taught by Moyo. Partial work remains eligible for tutoring. Report outcomes remain separate. Every unmarked/unknown problem starts eligible; detection failure cannot skip a problem.

## Screen references

All links below came from Mobbin MCP previews inspected in this pass, iOS platform. Cross-domain examples supply structure only; they provide no evidence for homework recognition or children's behavior. Moyo keeps its own semantic components, palette and navigation.

| Screen | Inspected reference | Apply / do not copy |
| --- | --- | --- |
| Subject pick | [Brilliant subject selection](https://mobbin.com/screens/401fae39-6fd4-42b1-955c-02814892a5d2) | Visible single selection and a separate continue action. Preserve Moyo's existing six subject chips rather than adding these cards. |
| Capture | [Airbnb ID camera framing](https://mobbin.com/screens/8a989178-714f-4505-a9bd-fb7da882e63b) | Clear capture target and short framing instruction. Do not imply automatic capture or ID verification exists in Moyo. |
| Processing | [Dropbox upload status](https://mobbin.com/screens/0344b16a-a8e5-442b-a8f9-efddae1ab159) | Per-item identity/status while upload continues. Do not copy its ETA without measured data; upload completion does not imply extraction completion. |
| Question review | [Slack completed list](https://mobbin.com/screens/054dcddf-43f1-4e84-9d42-1ae63a06504b) | Check shape plus visible text identifies a marked item. Retain unfinished and marked items in one review list; do not hide marked items behind tabs. |
| Learner start | [Brainly question companion](https://mobbin.com/screens/9f44639a-a601-4eb8-b696-93c638b7a950) | Current question remains named above help controls. Do not adopt the long answer transcript or expose an answer because of a prior-work mark. |
| All done | [Slack completed items](https://mobbin.com/screens/054dcddf-43f1-4e84-9d42-1ae63a06504b) | Retain identifiable completed rows so a parent can reverse a mark. This is a list-state reference, not a literal homework all-done screen. |

Search exclusions: Medium topic chips were replaced by the education-specific Brilliant result; Wealthfront's documents screen did not show processing and was replaced by Dropbox. Neither excluded preview is used as evidence.

## Mark and reusable component contract

Use the existing `packages/ui/Checkbox.tsx:Checkbox` / `Checkbox.web.tsx:Checkbox` semantics when implementing the review control; both are exported from `packages/ui/index.ts`. A shared prior-work presentation can compose that control for review and a read-only mark for learner progress/timeline. Component naming is an implementation decision, not an import asserted to exist.

| Property/state | Required presentation |
| --- | --- |
| Unchecked | Empty outlined square; label “Already done before upload”. No grade icon. |
| Checked | Check shape plus unchanged label, neutral `text`/`border` ink on `surface`. Do not use `grade`, redpen, score, or success language. |
| Read-only | Visible “Already done before upload” beside the question; do not communicate through strikethrough or color alone. Keep question text readable. |
| Pressed/focused | Existing checkbox pressed treatment and `focus` token; keyboard focus remains visible. |
| Saving | Preserve the last server-confirmed mark, disable repeated mutation, say “Saving change…”; do not announce a new count before confirmation. |
| Failed save | Restore confirmed mark; inline “Your change wasn’t saved. Try again.” Keep review and source pages. |
| Locked | “This worksheet has started. Already-done marks can’t be changed here.” Only use this when server contract disallows editing. |

Token source is `packages/theme/tokens.ts`: semantic `surface`, `text`, `text-muted`, `border`, `focus`; `radius.control`; existing `fontFamilies` and body type. No new color ramp, shadow, native control wrapper, animation dependency or raw feature hex. Use `bandScaleFor` from `packages/app/features/capture/age-band.ts` for learner surfaces. Target floors in `targets`: young 72, child 56, teen 48, adult 44 layout units. Guardian review uses the existing adult shell and should provide at least a 48-unit row target where composition permits; the glyph alone is not the target. Use min-height with wrapped content, never a fixed row height.

## States and copy

Guardian copy is adult copy regardless of the child's band. Show “7 problems, 3 already done” above review (with correct singular/plural). Helper: “Mark problems your child finished before uploading. This doesn’t check their answers.” Checkbox label includes the problem number in its accessible name. If no marks: “Mark any problems already done.” If all marked: “All 7 problems are marked already done.” Actions: “Review marks” and the existing return action. Do not label this “You solved 7 problems”.

| Pipeline value | Copy / action |
| --- | --- |
| pending | “Waiting to read your pages…” |
| extracting | “Reading your pages…” |
| extracted | “Review the questions” |
| failed | “We couldn’t read these pages. Your pages are still here.” / “Try again” |

Bind these strings only to actual submission pipeline values. Existing capture transfer records have a separate status/queue; use transfer copy there. The G0 source creates an already-extracted submission from confirmed text, so do not fake an extraction stage, percent, timer or retry worker for that path. Retry must invoke an implemented operation while retaining page identity. No question result: “No questions to review yet. Check the page or add another.” Failure and empty are distinct.

| Learner voice band | Current problem introduction | Prior-work label | All marked |
| --- | --- | --- | --- |
| K–2 (`young`) | “Let’s try problem 4.” | “Already done” | “These problems are marked done. Ask your grown-up if you want to try one.” |
| 3–5 (`child`) | “Start with problem 4.” | “Already done before upload” | “All problems were marked already done. Your grown-up can change a mark.” |
| 6–8 (`teen`) | “Continue with problem 4.” | “Already done before upload” | “All problems are marked already done. Ask your parent to review the marks if needed.” |
| 9–12 (`adult` presentation) | “Continue with problem 4.” | “Already done before upload” | “All problems are marked already done. A parent can review the marks.” |

The band mapping is the existing `age-band.ts:voiceBandFor`, not a new age inference. Learner progress retains marked positions and highlights only the server's current question. Guardian timeline says “Already done before upload” separately from the existing with-Moyo outcomes; no pre-finished item contributes a solved-with-Moyo total. If reopened, load the updated server cursor rather than predicting the next question.

## Accessibility and review gates

Accessible control name: “Problem 4, already done before upload”; checked/unchecked is the control state. Describe the question text in reading order without duplicating every word in the label. The implementation now passes `label` into the installed Expo Checkbox instead of rendering it only as sibling text. Its iOS adapter forwards that label to Toggle and its Android adapter builds a labeled toggleable row. This is source evidence; VoiceOver/TalkBack acceptance still needs validation. On web, retain role, aria-checked, keyboard toggle and visible focus. Avoid nested pressables that toggle twice.

At large text, number, text and mark can stack; full problem text and “Try again” stay reachable. No color-only state, gesture-only action, fixed-height clipping, or live announcements per render. Announce saved counts politely once per change. Test RTL without moving the physical-right native hardware rail. Preserve existing Expo Router, SplitView/AdaptivePanes and session identity across resize. Web retains header and phone-width bottom tabs.

Required critique evidence remains outstanding: phone captures of unchecked/checked/save failure/all-done, native screen-reader labels, 200% text, keyboard review on web, and parent correction. No physical captures were available to critique in this design pass.

## Procedure and skill gaps

Read `expo-design-system`, installed Mobbin `best-practices` and `search`, existing theme/checkbox/band sources, and the pinned tailored foldable skill in full from the identical local copy in `viro-external`; hash `69a051ad0a924f778ed54f9222fe8af0c5eef701`. Follow the repository's Legend Motion/adaptive transitions, not the skill's generic Kinetrell suggestion. Named `user-research`, `design-handoff`, `design-system`, `ux-copy`, `accessibility-review`, `design-critique` and `frontend-design` skills were not found in the inspected local skill roots. Their requested outputs are provided inline here; no load, interview, user test, classifier evaluation or device critique is claimed. This document adds no feature code.

---

**Your Mobbin AI usage is high this month**

Usage is unlimited during beta. If your usage stays at this level, you may need to purchase more credits once limits take effect. [View usage and plan options](https://mobbin.com/settings/billing-and-usage?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp)
