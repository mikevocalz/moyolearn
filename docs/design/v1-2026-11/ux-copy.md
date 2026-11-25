# UX copy: v1 new strings by band

Date: 2026-11-25. Voice: warm, plain, specific; sentence case; buttons start with a verb. Glossary binding: Log in, Create account, Learner, Grown-up (learner UI), Guardian (adult UI), Code, Session, Natalie. Bands follow `packages/theme/tokens.ts:targets` keys: K–2 = young, 3–5 = child, 6–8 = teen, 9–12 = adult. Doc 31 limits: K–2 ≤ 6 words per line, one instruction; 3–5 short sentences; 6–8 and 9–12 plain adult register.

Strings already in code are listed as confirmed and are not re-written. New strings are proposals for `copy/front-door.ts` (or the homework copy table once one exists; none was found in the homework feature, where strings are inline in `guardian-prior-work-review.tsx`, which the ux-copy skill flags as drift).

## Done mark (guardian surfaces)

Rule: the mark never says "correct", "right", "good job", or any grade word. Parent copy says "already done before upload" in plain words.

| Key | String | Status |
| --- | --- | --- |
| `priorWork.mark.label` | `Problem {n}, page {p}: Already done before upload` | confirmed, `prior-work-mark.tsx` |
| `priorWork.mark.readonly` | `✓ Already done before upload` | confirmed, `prior-work-mark.tsx` |
| `priorWork.review.open` | `Review already-done marks` | confirmed, `guardian-prior-work-review.tsx` |
| `priorWork.review.close` | `Close question review` | confirmed |
| `priorWork.review.count` | `{count} problems, {done} already done.` | confirmed (singular handled in code) |
| `priorWork.review.explainer` | `These marks skip work finished before upload. They do not check answers. You can change them before tutoring starts.` | confirmed |
| `priorWork.review.allDone` | `All problems were marked already done. Untick any problem your child still needs to work on.` | confirmed |
| `priorWork.review.locked` | `Already-done marks can only be changed before tutoring starts.` | confirmed |
| `priorWork.review.saving` | `Saving change…` | confirmed |
| `priorWork.review.saveFailed` | `Your change wasn't saved. Reload the review before trying again.` | confirmed |
| `priorWork.mark.hint` [new] | `Tick this if your child finished it before you uploaded. Natalie will skip it.` | Alternatives: "Mark as finished before upload" (shorter, but drops the consequence); "Already finished? Tick it." (too breezy for a guardian form). Picked for the consequence. |

## Done mark on learner surfaces

Learners never toggle a mark. Where a skipped problem appears (session summary), the caption is the band's "done before" line:

| Band | String |
| --- | --- |
| young | `Done before.` |
| child | `You did this one before.` |
| teen | `Done before upload.` |
| adult | `Done before upload.` |

No count of right or wrong appears beside it on any band.

## Hand coach (headset, three steps max, one gesture per step)

Buttons: each step `Skip`; final step `Start`. Reopen from help, never forced on resume. Step 2 ships only if direct touch is qualified; otherwise the ray-only line replaces it.

| Band | Step 1 | Step 2 (direct touch) | Step 2 (ray only) | Step 3 |
| --- | --- | --- | --- | --- |
| young | `Pinch to pick a button.` | `Touch the paper to write.` | `Pinch and hold to write.` | `Pick a tool on the tray.` |
| child | `Point and pinch to choose.` | `Touch the board to write. Lift your finger to stop.` | `Pinch and hold to write. Let go to stop.` | `Pinch a tool to change it.` |
| teen | `Aim your hand and pinch to select.` | `Touch the board with your fingertip to write.` | `Pinch and hold to write. Release to stop.` | `Select a tool on the tray.` |
| adult | `Aim and pinch to select.` | `Touch the board to write; lift away to end the stroke.` | `Pinch and hold to write. Release to stop.` | `Use the tray to change tools.` |

These match the table in `docs/design/hands-input-handoff.md` "States and copy"; the ray-only column is the handoff's replacement line expanded per band.

## Headset states (all bands unless noted)

| Key | String | Pattern |
| --- | --- | --- |
| `xr.trackingLost` | `Hands aren't visible. Move them into view.` | what happened + what to do (handoff) |
| `xr.trackingLost.young` [new] | `I can't see your hands. Hold them up.` | K–2: ≤ 6 words per line |
| `xr.listening` | `Listening…` with a visible `Stop` | loading sets expectation (handoff) |
| `xr.clear.title` / `.keep` / `.confirm` | `Clear this page?` / `Keep drawing` / `Clear page` | confirmation names the consequence (handoff) |
| `xr.exit.title` / `.keep` / `.confirm` | `Leave the Tutor Room?` / `Keep working` / `Leave room` | handoff; unsaved-work line only when the app knows work is unsaved |
| `xr.tool.selected` [new] | `{tool} selected` (live region, once) | state announced as text, not colour |
| `xr.undo.disabled` [new] | `Nothing to undo` | disabled keeps its label |

## Phone learner surfaces

| Key | Band | String |
| --- | --- | --- |
| `learner.problem.start` [new] | young | `Let's do this one.` |
| | child | `Let's work on this one.` |
| | teen / adult | `Start this problem` |
| `learner.summary.title` [new] | young | `You worked hard today!` (one exclamation per screen) |
| | child | `Here's what you worked on today.` |
| | teen / adult | `Today's session` |
| `learner.summary.back` | all | `Back to Today` (confirmed in doc 38 PW-03b) |

## No-paywall-on-learner-surface rule check

CLAUDE.md "Children's surfaces": no paywall, price, or upgrade prompt on a learner surface. Checked against the strings above and doc 38:

- Learner problem, session summary, hand coach, tool tray, headset states: no price, plan, trial, upgrade, or store word appears. PASS.
- PW-03b (free-limit stop, learner): doc 38 keeps it to `All done for this week!` / `Ask your grown-up to unlock more.` / `Show my grown-up` / `Back to Today`. "Unlock" is the one word to watch; it names no price and leads to a parent gate, so it stays. PASS with a note.
- FD-13 / PW-01 strings live on `(onboarding)/guardian/plan` only; `PlanCard.tier` type guard enforces it (doc 38 §12 row 05). PASS.
- Done-mark strings: no grade or score language. PASS.

## Localization notes

Buttons ≤ 20 chars: `Review already-done marks` is 25 and `Close question review` is 21; both are confirmed strings in code and should be shortened at the next copy pass (`Review done marks`, `Close review`). Counts use ICU plural in the table, not the ternary in `guardian-prior-work-review.tsx`. No concatenated sentences in new strings.
