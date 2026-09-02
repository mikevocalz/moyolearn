# ADR 102: The teacher shell exists, with four tabs — Home · Classes · Assign · You
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented on web; the mobile exists-only re-cut lands in the same push.

<!--
What it is: ADR-b of the G-navigation-maps §6 register — whether a teacher
shell exists at all (doc 36 §3.3 says tokened read-only page, no shell), and
if so its tab set; plus the fate of the built Conferences tab.
Why it exists: the shipped teacher layout declares six tabs under a fabricated
doc-36 citation and renders two of them; doc 36 defines no teacher IA to
conform to, so this is the one register item that must *author* an IA.
SOT: docs/pack/36-role-navigation-flows.md §3.3 §4 ·
     docs/pack/37-onboarding-dual-pane.md §2 (PR-145 amendment) ·
     docs/38-front-door-and-flow.md FD-23 ·
     docs/design/overhaul-v2/G-navigation-maps.md §1.5 §3.2 §5 §6 ·
     docs/design/overhaul-v2/E-tenant-role-band-matrix.md §5 G-5/G-10 ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md synthesis 4/13
SOT-KEYWORDS: adr teacher shell tabs classes assign you conferences
              fabricated-citation fd-23 overhaul
-->

## Context

- **Doc 36 §3.3's only teacher position:** "School-teacher variant (share-link viewer, doc 34) is a tokened read-only page — no shell, no login." A teacher shell is a divergence from doc 36 on its face.
- **But the divergence is already legitimized outside doc 36:** doc 37 §2's PR-145 amendment records that "the teacher (S25) flow … exists and ships: account → class → roster → assignment," and doc 38 gives it FD-23 (class + roster via class code, district SSO/LTI deferred to Phase 3). The repo ships a full `teacher` tree in `packages/app/providers/session/shell.ts` (E-matrix G-5: 7 shells, teacher included, accent minted). Retiring the shell would mean retiring a shipped, doc-38-specced onboarding lane — no document proposes that.
- **What the code declares is indefensible on its own terms:** `apps/mobile/app/(teacher)/(tabs)/_layout.tsx` lists six ITEMS (`teacher-home · classes · assign · calendar · conference · students`) under a comment citing "doc 36 §3.3: Home · Classes · Assign · Calendar · Students" — a fabricated citation (doc 36 §3.3 defines no teacher tab set), and six items breaks doc 36 §4.1's ≤5 law regardless. Only 2 of 6 render (`teacher-home`, `conference`); `/classes /assign /calendar /students` have no route files (A-repo-audit; C-orphans §Entries-with-no-route).
- **Derivation constraints from doc 36 §4 (which binds every shell):** ≤5 destinations with visible labels (§4.1); land on the thing you came to do (§4.2); the role switcher lives in Profile/You (§4.3) — a teacher is a Cool-dial multi-hat adult (guardian+teacher is a listed combination, E-matrix §3), so the shell needs a You anchor.
- **Competitor evidence (H synthesis):** #4 — teacher surfaces organize by job-to-be-done (SchoolAI's Launchpad/Spaces/Tools/Assistants; Khan's 2026 teacher left nav); the teacher's jobs per FD-23 are exactly class → roster → assignment. #13 — one canonical entry per job; Google Classroom keeps assignments inside class context and a class hub as the switcher, and its cost ("constant round-tripping" between classes) is why Classes earns a top-level tab while per-class detail is list→detail inside it. Nothing in the comparator set gives conferences or a calendar a teacher tab.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — 4 tabs: `Home · Classes · Assign · You` | Tutor-pattern Cool shell; Students folds into Classes as list→detail (doc 37 §3.3 pane pattern); Conferences + Calendar become stack routes from Home | `(teacher)/(tabs)/_layout.tsx:ITEMS`; `teacher-home.tsx` and `conference.tsx` exist; `AdaptivePanes` compound API for Classes\|detail (G §5) | ≤5 with room to grow; §4.3 You anchor; matches FD-23's class→roster→assignment loop; 3 of 4 route files are the smallest build delta | Demotes the built-and-rendering `conference.tsx`; Students is two taps |
| B — no shell (doc 36 literal) | Delete the teacher tree; teachers get only the tokened share page | `shell.ts`, `(teacher)/` group | Doc 36 as written | Contradicts doc 37's PR-145 amendment and doc 38 FD-23; throws away a shipped onboarding lane and shell; leaves guardian+teacher multi-hat adults with no door |
| C — build the declared 6 | Author the 4 missing route files | same layout | No IA rethink | Violates §4.1's ≤5 law; the set's only citation is fabricated; Calendar/Students/Conferences have no evidenced daily-loop claim |

## Decision

**The teacher shell exists** — doc 37 §2's amendment and doc 38 FD-23 supersede doc 36 §3.3's "no shell" line, which predates the S25 flow (the tokened read-only share page remains, unchanged, for the *link-viewer* case per doc 34).

**Its mobile IA is four tabs, Cool dial: `teacher-home (Home) · classes (Classes) · assign (Assign) · you (You)`** — G-navigation-maps §1.5's proposed set, adopted. Home leads with today's classes and assignments due (§4.2); Students folds into Classes as list→detail, becoming the `Classes|detail` pane surface on tablet (G §5, gated on this ADR, reusing `AdaptivePanes` as-is); You hosts the role switcher and the account-sheet anchor (ADR-106). **Conferences and Calendar are demoted to stack routes reachable from Home** — neither is a daily-loop destination that outranks the class/assignment loop FD-23 establishes; `conference.tsx` keeps its screen, loses its tab. The teacher *web* rail inherits this same set (G §3.2: teacher web currently duplicates the tutor nav — that duplication retires with this ADR).

## Consequences

- Easier: the shell finally has an IA a build slice can target; 2-of-6 ghost tabs disappear; the tablet pane story for teachers is defined; teacher web stops impersonating the tutor.
- Harder: doc 36 §3.3 needs a one-line amendment recording the shell's existence (pack amendment, cite this ADR — E-matrix G-5's "the pack needs an amendment or the shells need an ADR" resolves as: both, this is the ADR); `conference.tsx` users lose one-tap access; the school-sponsored entitlement gap under this shell (E-matrix G-3) remains open and is *not* resolved here.
- **Required code-comment correction (Phase-2 reconciliation PR):** the header comment in `apps/mobile/app/(teacher)/(tabs)/_layout.tsx` — "doc 36 §3.3: Home · Classes · Assign · Calendar · Students" — is a fabricated citation; replace it with a citation of this ADR and doc 37 §2's amendment as the shell's actual authority.
- Follow-ups: create `classes.tsx`, `assign.tsx`, `you.tsx`; move `conference` out of `(tabs)`; ITEMS → the four above; `Classes|detail` panes as the third `AdaptivePanes` consumer (G §5 adoption note).

## Default replaced

Register ADR-b's no-ADR default was "shell stays (doc 37 amendment precedent), proposed set adopted." This ADR **confirms the default with its evidence trail** and additionally settles what the default left open: Conferences is demoted to a stack route, and teacher web inherits this set instead of the tutor's.

## Constraints honored
Zustand-only (pane selection in scoped store per doc 37 §3.2) · tokens-only · no invented APIs (`AdaptivePanes` reused, not forked) · doc references (36 §3.3/§4 · 37 §2/§3.3 · 38 FD-23 · G §1.5/§3.2/§5 · E §5 G-5/G-10 · H synthesis 4/13)
