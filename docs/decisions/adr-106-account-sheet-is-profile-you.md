# ADR 106: The account sheet is the mobile chrome form of Profile/You — not a sixth destination
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented in code.

<!--
What it is: ADR-f of the G-navigation-maps §6 register — record-keeping ADR
establishing that the to-be-built AvatarSheet is doc 36 §4.3's Profile/You
surface rendered as chrome, so it can never be argued into a tab or drawer.
Why it exists: doc 36 specifies the role switcher "lives in Profile/You" but
never names a sheet; the sheet is an overhaul-prompt §9.2 addition that must
be recorded before Phase 2 builds it, or its contents will drift into a
shadow nav (the guardian Account tab it replaces is the cautionary example).
SOT: docs/pack/36-role-navigation-flows.md §3.1 §4.1 §4.3 §5 ·
     docs/design/overhaul-v2/G-navigation-maps.md §2 §4 §6 ·
     docs/38-front-door-and-flow.md PW-05 · FD-24 ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md #1 #8 #17 synthesis 6
SOT-KEYWORDS: adr account-sheet avatar-sheet profile you chrome shell-header
              context-switcher sign-out plan-billing overhaul
-->

## Context

- **The surface is currently ABSENT:** no account sheet, drawer, or avatar surface exists on mobile. `ShellHeader`'s avatar branch requires `profileHref` and zero call sites pass it — dead code (`apps/mobile/components/ShellHeader.tsx:39-49`, C-orphans §Dead-code-in-chrome); `AvatarSheet` is on packages/ui's absent list; B-deliverable-status row H: ABSENT (G-navigation-maps §2).
- **Doc 36 specifies the *function*, not the form:** §4.3 — role switch is a full shell swap and "lives in Profile/You." It never names a sheet; sheet-vs-You-screen is an overhaul-prompt §9.2 addition (G §2's ⚠). Doc 36 §4.1 caps destinations at 5 — a sheet that behaved like a destination would silently break the cap on 5-tab shells.
- **The pieces already exist or are doc-assigned:** `ContextSwitcher` (`packages/app/providers/session/context-switcher.tsx`, today buried in profile screens), `Avatar` + `useProfile`, root-level `settings.tsx`, doc 38's PW-05 plan routes, and a scaffolded-dead Sign out (`packages/app/features/settings/settings-content.tsx:83` — `onPress={() => {}}`). The sheet is assembly, not invention (G §2 table).
- **Competitor evidence (H):** the account surface lives behind the avatar/You anchor everywhere — Khan's Profile tab / top-right name dropdown (#1), Canvas's Account at the top of the rail (#8), Slack's You tab (#17); none of them make it a content destination. Slack is also the cautionary tale for what goes *in* it: hiding the workspace switcher behind extra clicks caused the most-litigated shell regression in the comparator set (synthesis 6) — the switcher must stay one visible gesture from the avatar.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — sheet as chrome form of Profile/You | One `AvatarSheet` in packages/ui, content from packages/app, opened from `ShellHeader`'s avatar once `profileHref`/`onAvatarPress` is wired per shell; root-mounted | `ShellHeader.tsx:39-49` · `context-switcher.tsx` · `settings.tsx` · `profile.store.ts` | Same surface on every shell; keeps tab caps intact; matches Khan/Canvas/Slack anchor pattern; gives guardian Account-tab content (ADR-101) a home | One more root-mounted sheet to maintain |
| B — You screen only, no sheet | Every shell gets/uses a You tab screen | learner `you` exists; guardian/org do not | No new component | Guardian and org have no You tab (doc 36 gives them Family/Safety in slot 4) — their account functions would need a tab the docs don't grant, re-breaking ADR-101 |
| C — drawer | The drawer the guardian layout comments once promised | none — no Drawer exists (A-repo-audit §Header/chrome gaps) | — | A drawer is a nav container; it invites destination creep — exactly what §4.1's cap and G §4's no-duplication law exist to prevent |

## Decision

**Build the `AvatarSheet` (option A), formally recorded as the mobile chrome form of the same Profile/You surface doc 36 §4.3 defines — it is chrome, not navigation, and never a sixth destination.** Binding properties, per G §2:

- **No-duplication law applies:** nothing in the sheet may duplicate a tab; it deep-links into destinations (e.g. `/settings`, PW-05 plan routes) rather than replicating their lists — mirroring §4's rail-XOR-utility-bar rule on web.
- **Contents per role are G §2's table:** identity header; `ContextSwitcher` when ≥2 memberships (surfaced here from its buried profile-screen mount — one gesture from the avatar, the Slack lesson); Profile & settings; Plan & billing (guardian `(guardian)/settings/plan`, org owner `(org)/settings/plan` — PW-05, doc 38 §3); notification prefs; Sign out wired to the live AuthPort (retiring the dead `onPress={() => {}}`).
- **Learner rules:** the learner sheet exists for 6–8/9–12 only; K–2/3–5 keep everything guardian-side (doc 36 §3.1 "no settings — guardian-side only"); Plan & billing renders for learners **never**, on any paid state (doc 38 — learner column is "nothing"; PW-03b law).
- **Mechanics:** root-mounted like every sheet (Gorhom nesting bug, A-repo-audit); role accent only as the avatar ring (doc 36 §5 allowlist); FD-24's family-device profile switch is a *different mechanism with a different threat model* and is not this sheet (E-matrix §3 — do not conflate).

## Consequences

- Easier: guardian's retired Account tab (ADR-101) and org/tutor account functions get one consistent home; the ContextSwitcher becomes discoverable; web's `MembershipMenu` and this sheet converge on the same G §2 row set.
- Harder: every shell layout must actually wire the avatar press (the current zero-call-site state is how the surface stayed absent); the sheet becomes a tempting dumping ground — the no-duplication law must be enforced in review, since nothing structural stops a settings list from being copied into it.
- No code-comment corrections required by this ADR (the fabricated citations belong to ADRs 101–103); the guardian layout comment's phantom "drawer/secondary surface" claim dies with the ADR-101 correction.
- Follow-ups: build `AvatarSheet` in packages/ui + content in packages/app; wire `onAvatarPress` in all shell layouts; wire Sign out to the live AuthPort; land PW-05 plan routes it deep-links to.

## Amendment — 2026-09-02: the avatar is the anchor on every band

The decision above says "the learner sheet exists for 6–8/9–12 only", and the
first implementation read that as a rule about the ANCHOR: `ShellHeader` rendered
a blank spacer in the right slot for `young` and `child`. That conflated two
different questions — *who may see the account sheet* and *whether the bar has a
right-hand control*. Doc 36 §3.1's constraint ("no settings — guardian-side
only") is about the sheet's CONTENTS.

**Amended:** the avatar renders for every authed band, and the band picks what it
opens.

| Band / role | Avatar opens |
|---|---|
| K–2 (`young`), 3–5 (`child`) learners | FD-24 `SwitchProfileSheet` — "Who's here?" |
| 6–8 / 9–12 learners, and every adult role | `AccountSheet` (unchanged) |
| `anon` | nothing — no identity to anchor, no device to hand over |

Every guarantee in the Decision section survives: no setting, plan, billing or
sign-out row becomes reachable by a young learner, because the switcher carries
none of them. It is the family-device hand-off this ADR's §Mechanics already
names as a *separate mechanism with a separate threat model* — the point of that
sentence was that the two must not be merged, not that a child may never reach
the switcher, and the learner You screen already offers it to `young`
unconditionally (`profile-content.tsx`). Grown-ups stays behind `grownUps:
'absent'` there, exactly as on the You screen: a shell header owns no biometric
or family-PIN surface, so the padlocked row is omitted rather than shown dead.

What the old reading cost: a K–2 shell was the only chrome in the product with a
dead corner, and "this is me / how do I hand the tablet to my sister" — the one
account-shaped question a six-year-old actually has — was answerable only from a
You tab that the K–2 IA does not contain.

Recorded in code at `apps/mobile/components/ShellHeader.tsx` (file header) ·
sheet at `packages/app/features/switch-profile/switch-profile-sheet.tsx`.

## Default replaced

Register ADR-f's no-ADR default was "build the sheet." This ADR **adopts the default** and supplies what the default lacked: the recorded identity claim (sheet ≡ Profile/You chrome, never a destination) and the binding content/mechanics rules that keep it from becoming shadow navigation.

## Constraints honored
Zustand-only (`profile.store.ts`, session stores) · tokens-only (accent = avatar ring only, doc 36 §5) · no invented APIs (ShellHeader avatar branch, ContextSwitcher, existing sheet mounting reused) · doc references (36 §3.1/§4.1/§4.3/§5 · 38 PW-05/FD-24 · G §2/§4 · E §3 · H #1/#8/#17, synthesis 6)
