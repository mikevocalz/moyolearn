# Mobbin pass: v1 screens

Date: 2026-11-25. Every link below was returned by `mcp__mobbin__search_screens` in this session (platform `ios`, `task_intent` "Designing the front door — auth, signup, role onboarding — for a K-12 AI tutoring app", limit 6) and the preview image was read. Notes are structure only. Moyo's tokens, palette, type and copy system stay. Where a doc 38 §3 anchor already covered the screen, the canonical pick is the one that best matched the preview, and the doc 38 anchor is noted.

| Screen | Canonical link | App | Structural move | Doc 38 anchor |
| --- | --- | --- | --- | --- |
| Welcome (FD-01) | https://mobbin.com/screens/ed95bf0e-e7b0-46f5-af57-79e2e952c3aa | Brilliant | Photo of a real learner above one tagline, then two role doors stacked ("I'm a learner" / "I'm a parent or teacher") with the returning-user link last. Moyo keeps three doors (Get started, Log in, I have a code) in that order. | Greenlight 3f22d323 · Duolingo ABC 3e07698e |
| Signup (FD-04) | https://mobbin.com/screens/72fea6c6-3ef5-4141-a1b4-6bf21ec15e2b | Airbnb | Password field with a visible Show control and a live strength line under it; the legal sentence sits directly above the primary button; the marketing opt-in is a separate, unchecked box below the button. | Grok 738bef4a · Buffer 6e6e0c03 |
| Consent (FD-10) | https://mobbin.com/screens/ce83a157-05ad-4a14-82d9-6eab5acd9d68 | Starling | Short heading about the child's data, then a boxed three-row list of what the parent should do or know, a link to a child-readable policy, and one Continue. Matches FD-10's three plain "what we collect and why" rows. | SHEIN 23436048 |
| Add child (FD-12) | https://mobbin.com/screens/0f4e42d0-eb09-4284-852a-f199759ecdbd | YouTube Kids | Avatar first, then first name, then age; nothing else. FD-12 swaps age for the grade segmented picker. | YouTube Kids 0f4e42d0 (same) |
| Plan and paywall (FD-13 / PW-01) | https://mobbin.com/screens/73a2cafa-d97e-477b-9e00-1e276ef50151 | Pillow | Trial timeline (today, reminder day, trial end) above the price; "Cancel anytime" as plain text under the primary; Terms, Restore and Redeem as real links in the footer. | Pillow 73a2cafa (same, PW-06) |
| Upload | https://mobbin.com/screens/0344b16a-a8e5-442b-a8f9-efddae1ab159 | Dropbox | One row per item with its own name and status while the batch continues; a Close that does not cancel. The ETA line is not adopted (no measured data). | Prior-work handoff: same link |
| Review with done marks | https://mobbin.com/screens/054dcddf-43f1-4e84-9d42-1ae63a06504b | Slack | Completed items keep their full title and metadata beside a filled check; nothing is struck through or hidden. Moyo keeps one list without Slack's All/Open/Completed tabs. | Prior-work handoff: same link |
| Learner problem | https://mobbin.com/screens/d682cbb0-7f0c-48b9-b3e3-163aa2824e57 | Brainly | The problem stays pinned at the top above the tutor conversation; Question / Answer / Chat are separate tabs so the answer is never on the problem view by default. Moyo has no Answer tab for a learner. | Prior-work handoff: Brainly 9f44639a |
| Session summary | https://mobbin.com/screens/96d1ddfe-0b36-4811-a89d-7a6f8bac1a05 | Quizlet | A list of the items worked this round, each with its text visible, under one progress line and one Continue. Moyo drops the "Correct" count from the headline (see refused). | none in doc 38 |
| Hand coach | https://mobbin.com/screens/54ee72cd-e5fd-47d3-91a7-76214ce77c0e | Pinterest | One card at the bottom edge over the live canvas: what you are learning, Skip and Next side by side, canvas stays visible and untouched. Three steps at most for Moyo. | Hands handoff: Slack a881bea5 |
| Tool tray | https://mobbin.com/screens/23b4ee8f-32d4-4ad1-8bb4-e5c1484fdcdf | Apple Mail | Tools in one row under the canvas; the selected tool has a raised treatment; width and colour open as a second row above the tray, not a hidden menu; undo/redo in the top bar. | Hands handoff: same link |

## Refused

| App | Link | Pattern | Why refused |
| --- | --- | --- | --- |
| Nibble | https://mobbin.com/screens/43b10bcd-05d6-496b-a3ae-051f56687de5 | "Replace scrolling with addictive learning" plus an award badge on Welcome | Badge wall and engagement framing aimed at a child's parent; CLAUDE.md "Children's surfaces" bans pressure mechanics |
| Spotify Kids | https://mobbin.com/screens/6a5a9f79-de2b-499a-919b-283c328a9ad4 | Full legal text scroll with "I accept and continue" at the end | Consent that a parent cannot read in the time it takes to tap; FD-10 wants three plain rows |
| Revolut | https://mobbin.com/screens/da5f6287-1092-4112-8dd7-72bd5803dd48 | Date of birth on the child record | FD-12 collects first name and grade only |
| Zocdoc | https://mobbin.com/screens/8dff0d14-5b94-439e-b188-7bd7083b1ec3 | Two long consent checkboxes, sex field, DOB on signup | Data minimisation; one adult attestation box is enough |
| 5 Minute Journal | https://mobbin.com/screens/855c42a9-4d3c-4c80-86b4-45ee94667c74 | "BEST VALUE" badge on the only plan | Fake comparison; FD-13 shows one Family tier |
| Mimo | https://mobbin.com/screens/b5772854-5c51-4fca-b828-0df669bfa4d4 | "Lesson complete!" with Accuracy % and XP | Grades and scores on a learner summary; the done mark and summary never grade |
| Quizlet (same screen) | https://mobbin.com/screens/96d1ddfe-0b36-4811-a89d-7a6f8bac1a05 | "7 Correct" headline | Adopted for list structure only; the correctness counter is refused |
| Otter / Superpower | https://mobbin.com/screens/1228d472-6531-4c65-b242-1f4037e1b71d · https://mobbin.com/screens/92693ca8-42cd-48d1-b1e5-a1a35ac02a55 | Strike-through on completed items | A struck-through problem reads as finished and graded; Moyo keeps the text intact beside the mark |
| Snapchat | https://mobbin.com/screens/af80cd74-548e-4033-9233-6198aa74953c | Three gestures taught at once on one overlay | More than one gesture per step; the hand coach teaches one per step |
| Craft | https://mobbin.com/screens/6a91e0ce-13a4-42fe-b5d8-9d2aba344871 | Unlabelled pen icons with a hidden colour wheel | Tray tools must carry a label and colour names (hands handoff "Selected tool" row) |

## Not found

No MCP result for a phone "learner problem" view with a done-mark-aware skip; the Brainly result covers the problem-pinned structure only. No result for a seated-headset tool tray; the Apple Mail result is a phone tray and says nothing about Quest reach.

## Queries used

welcome screen photo hero get started log in kids education app · create account form name email password terms checkbox · parental consent attestation screen what we collect and why checkbox confirm parent · add child profile first name grade picker kids app parent · free trial paywall reminder before trial ends cancel anytime single plan price · upload homework photo processing status per page list · review list items with checkbox completed items stay visible with text · single question problem view with hint step by step tutoring child · session summary end of lesson recap what you practiced kids learning app · gesture tutorial coach mark one gesture demonstrated skip step · drawing tool tray pen highlighter eraser undo beside canvas
