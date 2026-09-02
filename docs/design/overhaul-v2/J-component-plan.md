# Overhaul v2 — Deliverable R: App-Wide Component Plan (Phase 3)

What it is: the §17.1 deliverable-R component plan for the app at large — every absent primitive either BUILT (with variants, composition, stories, first phase, and the contracts that demand it) or REJECTED with the covering alias, so Phase 3 builds nothing twice and nothing speculative.
Why it exists: B-deliverable-status row R is PARTIAL — doc 38 §8 covers only the front door, `docs/site/component-inventory.md` only marketing; the app-wide plan was absent. A-repo-audit §packages/ui names the absent list and the board seam; this file disposes of every name on it.
Source of truth: A-repo-audit.md §Shared-packages · I-token-system.md · G-navigation-maps.md §2–§4 · docs/decisions/adr-101..107 · design/screens/*/contract.md (state_owner `[add]`s + Notes) · docs/38-front-door-and-flow.md §8 · packages/ui/index.ts (THE component index) · docs/design/ui-promotions.md (promotion method).
SOT-KEYWORDS: overhaul, component-plan, build-list, alias-table, avatar-sheet, stage-board, band-variant, rail-grouping, storybook, phase-3

Status: Phase-1/2 deliverable, binding for Phase 3. Branch: `overhaul/phase1-audit`.

Method (binding, from `docs/design/ui-promotions.md`): a component gets built when contracts demand it in more than one place, or when one contract carries a doc-mandated capability nothing existing composes — **the trigger is duplication (actual or scheduled), never headcount or speculation**. Every BUILD below cites the contracts that need it; anything the overhaul prompt names that no contract references is listed in §8 as not-built, by rule.

---

## §1 · Official alias table — naming drift, formalized

A-repo-audit §packages/ui found the kit present "sometimes under different names than the overhaul prompt uses." These are now the **official aliases**. Nobody builds the left column; a PR introducing any left-column name as a new component is a defect.

| Prompt / doc name | Official component (packages/ui) | Note |
|---|---|---|
| Metric | `StatCard` | |
| Sheet | `BottomSheet` + `SheetSurface` | root-mounted always (Gorhom nesting bug, A-repo-audit) |
| Skeleton | `LoadingSkeleton` | |
| Table | `DataTable` | TanStack; k-anon `Suppressible` included |
| BottomTabs | `TabBar` + `TabBarAccessory` | mobile shells use `ShellTabBar` (apps/mobile) over it |
| NavigationRail | `DashboardShell` `mode: 'rail'` | a mode, not a component — never build a second rail |
| Surface | token family `surface` / `surface-raised` / `surface-sunken` | deliberately not a component (I-token-system §Semantic) |
| WebUtilityBar | `DashboardShell` `topBarStart` / `topBarEnd` slots | G §4 — the slots ARE the utility bar |
| SessionCard | `ScheduleCard` | extend with a variant if a contract needs one; never a sibling |
| ErrorState | `EmptyState` (extend: `tone="error"` + retry action) + `ErrorMessage` | see §2.2 |
| TenantSwitcher | `ScopeSwitcher` (packages/app/providers/session) | app-side; evolves in place per G §4 start slot — no ui build |
| ChildSwitcher | app-side build over `Avatar` + `PressScale` | §2 row 10 — switchers live in packages/app, per the audit |

---

## §2 · Build list, prioritized by contract demand

Ordering = number of contracts/phases blocked, then doc mandate weight. "First phase" uses the Phase-3 lane names (P3-guardian, P3-learner, P3-tutor, P3-org, P3-teacher, P3-FD).

### 1. `AvatarSheet` — BUILD (packages/ui chrome; content app-side) — blocks every shell
- **Contracts:** `guardian/guardian.account` (disposition FOLD is *sequenced on this build*: build sheet → wire avatar → drop tab), `learner/learner.you`, `tutor/tutor.you`, `teacher/teacher.you`, plus the org column of G §2's per-role table; mandated by ADR-106 (ADR-f).
- **First phase:** P3-guardian (the ADR-101 4-tab fold cannot land without it) — earliest build in the whole plan.
- Full spec in §3.

### 2. `StageBoard` — BUILD (packages/ui, platform-forked) — the CRM board
- **Contracts:** `org/org.crm` (primary action is "move a lead through stages — drag on the board view"); doc 28 §3 "kanban by stage"; A-repo-audit: "**No kanban/board component exists anywhere**."
- **First phase:** P3-org.
- Full spec in §4.

### 3. `Banner` — BUILD (packages/ui)
- **Problem:** persistent inline notice. `Toast`/`notify` are transient; `EmptyState` is a whole-surface state; nothing renders a non-blocking in-flow banner.
- **Contracts:** `guardian/guardian.home` (incident banner → guardian.alerts; `past_due` "non-blocking banner → PW-05, never a lockout"; trial-ending card), `learner/learner.home` (offline banner, band-voiced copy), `learner/learner.progress` (last-synced read-only notice), `org/org.money` + `org/org.schedule` (staleness labels, "money actions never fire offline"), doc 38 §5B entitlement banners.
- **Variants:** `tone` (`info | warning | incident | offline`) — token-mapped, never a red page-frame (doc 31: severity never floods a row); `dial` (hot/cool inherited from `Dial` context); optional single action slot (deep-link or retry). Band voice is *content*, not a component axis.
- **Composes:** `Card` surface tokens + `Text` + `Button`(ghost) + `Motion` mount.
- **Stories:** `Banner.stories.tsx` — per tone × dial; with/without action; incident tone contrast check; reduced-motion.
- **First phase:** P3-guardian (incident banner + entitlement states).

### 4. `FilterBar` — BUILD (packages/ui) — decided in §5, listed here for rank
- **Contracts:** `org/org.safety` (filter by severity/lifecycle), `org/org.inbox` (filter by kind), `tutor/tutor.incidents` (filter by status), `tutor/tutor.resources` (filter by subject/band), `org/org.crm` (filters/sort/saved views — URL-param law).
- Five Cool web surfaces landing in the same phase window would otherwise hand-roll five toolbar compositions — exactly the copy-paste lineage ui-promotions §1.2 documents. Building once first *is* "never copied into a second feature."
- **Variants:** cool dial only (no hot consumer exists — learner shells have no filters and K–2 bans search, doc 36 §3.1); slot-based: `SegmentedControl` | `Select` | `SearchBar` children + a clear-all affordance. **State law:** FilterBar owns zero state — it renders values and emits changes; on web the owner is URL search params (ops store header law), on mobile the screen's store.
- **Composes:** `Toolbar` + `SegmentedControl` + `Select` + `SearchBar` + `Badge` (active-filter count).
- **Stories:** `FilterBar.stories.tsx` — empty/active/overflowing (horizontal scroll), each control kind, clear-all.
- **First phase:** P3-org (org.safety web rail view is D's build item).

### 5. `OtpField` + `LearnerCodeEntry` — BUILD (packages/ui, per doc 38 §8 spec verbatim)
- **Status check (doc 38 §8 "what landed"): nothing landed.** Zero hits for any §8 component name anywhere in apps/ or packages/ — the entire §8 set is still owed.
- **Contracts:** FD-05 (check email OTP), FD-07 (reset), FD-08 (learner code — `LearnerCodeEntry` wrapper: `size="xl"`, `mode="alnum"`, dash after cell 3, K–2 type scale) — doc 38 §5's specs are these screens' contracts (README rule) — plus `teacher/teacher.classes` ("Roster students via class code (FD-08 LearnerCodeEntry)").
- **Variants:** per §8 table — `length`, `mode digits|alnum`, `size md|xl`, `autoSubmit`, `error`. One hidden `TextInput` with `oneTimeCode` semantics; cells mirror it.
- **Stories:** default/focused/filled/error/disabled × md/xl; `LearnerCodeEntry` gets its own story (band targets visible).
- **First phase:** P3-FD (FD-05); `LearnerCodeEntry` again at P3-teacher.

### 6. `PlanCard` — BUILD (packages/ui, doc 38 §8 spec)
- **Contracts:** FD-13 (choose plan), PW-05 (`(guardian)/settings/plan` — the AvatarSheet deep-link target), PW-08 (org plan). `tier: 'family' | 'business'` rendering guard enforced by route-level type per §8. PW-03b law restated: this component may **never** mount on a learner surface.
- **Composes:** `Card` + `Badge` + `Text`/`Heading` + radio semantics (`RoleChoiceCard` selection pattern shared).
- **Stories:** family/business × selected/default × with/without badge + trial line.
- **First phase:** P3-FD.

### 7. `PasswordField` + `PasswordRules` — BUILD (packages/ui, doc 38 §8 spec)
- **Contracts:** FD-02, FD-04, FD-06/07. Labeled Show/Hide (text, not icon-only), rules via `aria-describedby`, error-styled only after blur/submit.
- **Composes:** `TextField` + `Text`.
- **Stories:** hidden/shown, rules passing/failing pre- and post-blur, error.
- **First phase:** P3-FD.

### 8. `ProfileSwitcher` — BUILD (packages/app feature component; sheet chrome from `BottomSheet`)
- **Contracts:** FD-24 (switch profile), `guardian/guardian.account` (exit `role_or_context_switch: FD-24`), `learner/learner.you` + `learner/learner.home` + `learner/learner.tutor` (cross-device continuity rows all route through the FD-24 family-device switch).
- **ADR-106 boundary is binding:** this is "a different mechanism with a different threat model" than the AvatarSheet — learner avatar rows + locked `Grown-ups` row (biometric/family PIN, doc 07). Never merged with, never launched from, the AvatarSheet.
- **Composes:** `BottomSheet` + `Avatar` + `List/ListItem` + `PressScale`; PIN/biometric via the AuthPort lane.
- **Stories (feature story, apps glob):** 1/2/3 learners, locked row, unlock flow states.
- **First phase:** P3-FD (FD-14/FD-24 lane), consumed by P3-learner.

### 9. `RoleChoiceCard` — BUILD (packages/ui, doc 38 §8 spec)
- **Contracts:** FD-03 (who's this for), FD-09 (invite acceptance uses the same selection semantics). Radio-in-radiogroup, min 72dp, accent per doc 36 allowlist.
- **Composes:** `Card` + `PressScale` + icon slot; selection ring uses `role-*` tokens.
- **Stories:** default/hover/focus/selected/disabled × 2 and 4 options.
- **First phase:** P3-FD.

### 10. `ChildSwitcher` — BUILD (packages/app — switchers live app-side, per the audit)
- **Contracts:** `guardian/guardian.home` ("Switch active child — child-switcher chips, doc 36 §3.2"; "child switching does not exist (G-8)"), `guardian/guardian.family` (writes `activeChildId` so every per-child surface reads one seam), `guardian/guardian.reports` (list filters ride `family.store [add]`'s activeChildId), `guardian/guardian.calendar`.
- **State law:** reads/writes `family.store [add]` only — this build ends the G-8 squatting in `ai-activity.store`.
- **Composes:** `Avatar` + `Text` + `PressScale` chip row (no new ui primitive — pure composition; if a second chip-row consumer ever appears, promote *then*, per the ui-promotions trigger).
- **Stories (feature story):** 1 child (hidden), 2–3 children, active state, overflow.
- **First phase:** P3-guardian.

### 11. `ConsentCheckpoint` — BUILD (packages/app feature component, doc 38 §8 spec)
- **Contracts:** FD-10 (COPPA verifiable parental consent). Method cards from doc 06's enabled set + attestation + doc-07 data-use rows; state in `consentStore`.
- **Composes:** `Card` + `Checkbox` + `Button` + `Collapsible` (data-use rows).
- **Stories (feature story):** per method-set permutation, attestation unchecked/checked, verify pending/failed.
- **First phase:** P3-FD.

### §2.2 Retrofits to existing primitives (not builds)

| Component | Change | Contracts |
|---|---|---|
| `EmptyState` | add `tone="error"` + retry action slot → covers every `*_fetch_failed: inline retry` failure path; retires the ErrorState idea | tutor.earnings, tutor.resources, tutor.incidents, org.money, org.safety, org.inbox (all declare inline-retry failure paths) |
| `ScheduleCard` | verify against `org.schedule`/`tutor.today` timeline rows before anyone drafts a "SessionCard" | org.schedule, tutor.today |
| `Badge` | lifecycle-tone mapping for incident status pills (new→…→closed) — tones from tokens, never red-flooded | tutor.incidents, org.safety |
| `TwoPaneShell`/`BrandPaneContent` | doc 38 §8's `[verify]` item: width-class table + header-band collapse; add `variant` (`welcome | photo | accent`) if missing | FD-01..FD-13 (dual-pane law, doc 38 §4) |
| `TrendLine` | fix the `#2952D9` hex leak (I-token queued item 1) + chart palette tokens (queued item 4) | learner.progress, guardian.report-detail, district outcomes |

---

## §3 · AvatarSheet — spec (ADR-106)

**Identity claim (binding):** the sheet is the mobile chrome form of doc 36 §4.3's Profile/You surface — chrome, not navigation, never a sixth destination. The no-duplication law applies: nothing in it duplicates a tab; it deep-links (`/settings`, PW-05 plan routes) rather than replicating lists.

**Composition:**
- `packages/ui/AvatarSheet.tsx` — chrome only: `BottomSheet` + `SheetSurface` + a slotted layout (identity header slot, rows slot). Role accent appears **only** as the `Avatar` ring (doc 36 §5 allowlist).
- `packages/app/features/profile/account-sheet-content.tsx` — content assembly: identity header from `Avatar` + `useProfile` (`profile.store.ts`); `ContextSwitcher` (surfaced from its buried profile-screen mount — one gesture from the avatar, the Slack lesson in ADR-106); rows as `List`/`ListItem` deep-links; Sign out wired to the live AuthPort (retiring `settings-content.tsx:83`'s dead `onPress={() => {}}`).
- Root-mounted in `apps/mobile/app/_layout.tsx` like every sheet (Gorhom nesting bug); opened via `onAvatarPress` wired in **every** shell layout — the current zero-call-site `ShellHeader` avatar branch is how the surface stayed absent.
- Web convergence: `MembershipMenu` (RoleShell) converges on the same row set; the content component is shared, the chrome differs (sheet on mobile, `Menu` popover in the utility-bar end slot).

**Per-role contents (G §2 table, verbatim as law):**

| Row | Learner 6–8/9–12 | Guardian | Tutor | Teacher (ADR-102 You anchor) | Org staff |
|---|---|---|---|---|---|
| Identity header (avatar, name, role noun) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ContextSwitcher (≥2 memberships) | — (a child never switches) | ✅ | ✅ | ✅ | ✅ |
| Profile & settings deep-link | — (You tab only) | ✅ → `/settings` | ✅ | ✅ | ✅ |
| Plan & billing (PW-05) | **never**, any paid state | ✅ → `(guardian)/settings/plan` | — | — | owner only → `(org)/settings/plan` |
| Notification prefs | — | ✅ | ✅ | ✅ | ✅ |
| Sign out (live AuthPort) | — (guardian-managed device) | ✅ | ✅ | ✅ | ✅ |

**Band law:** the learner sheet exists for **6–8/9–12 only** and renders the identity header alone; K–2/3–5 get no sheet at all — everything stays guardian-side (doc 36 §3.1). The band gate depends on the band-population fix (A-repo-audit defect (a)) landing first; until then the gate would fail open.

**FD-24 boundary:** the family-device `ProfileSwitcher` (§2 row 8) is a different mechanism — never conflated, never cross-launched.

**Stories** (`AvatarSheet.stories.tsx` + feature story for content): chrome open/closed; per-role content × single/multi membership; org owner vs staff (plan row); learner band-gated minimal sheet; sign-out pending state; switcher expanded.

---

## §4 · StageBoard — the CRM board (audit seam)

**Name:** `StageBoard` (`packages/ui/stage-board/` — new directory: **add its glob to `.storybook/main.ts`**, the bug class fixed three times already for audio/adaptive-panes/layout).

**Seam, per A-repo-audit §packages/ui:**
- Gesture: generalize `ReorderRow`'s pattern (`packages/app/features/editor/reorder-row.native.tsx` — handle owns the gesture, UI-thread shared values, **single commit on release**, haptics) from 1-D row reorder to 2-D cross-column card drag. `EventDrag` (`features/schedule/event-drag.{native,web}.tsx`) is the 2-D snap-drag reference for the platform-fork shape. `DropZone` is OS file-drop only — not this.
- Model stays app-side: `StageBoard` is generic (`columns: {id, title, tone}[]`, `items`, `renderCard`, `onMove(itemId, toColumnId, index)`); the ops mapping (`Stage`, `Lead`, `STAGE_TONE` from `features/ops/ops.data.ts`) lives in a `features/ops` board view, with writes through the existing `applyStageChange` pure reducer + `use-stage-action` optimistic write (visible rollback + inline retry per the contract's `stage_write_failed` path).

**Board ⇄ table law (org.crm contract, BINDING):** the board and the table are two *views over the same store*, never two stores. The switch is a `viewMode: 'table' | 'board'` key added to `createOpsPrefsStore` (durable per-device pref) — **not** a new store; filters/sort/saved views stay in URL search params, shared by both views; switching views never loses filters or selection.

**Variants:** cool dial only (ops surface; no hot consumer exists); density reusing the `DataTableDensity` scale so board and table density prefs read one setting; platform forks `.native.tsx` (gesture-handler + reanimated) / `.web.tsx` (pointer events, keyboard-accessible move via card menu — a drag-only board fails WCAG).

**Stories** (`stage-board/StageBoard.stories.tsx`): empty pipeline ("Add your first lead" live empty state), populated, drag-in-progress, drop-target highlight, optimistic-rollback error, column overflow scroll, keyboard move, reduced-motion.

**First phase:** P3-org. Contracts: `org/org.crm` (sole consumer by design — the wall: no learner data, no incidents, ever).

---

## §5 · Shell primitives — genuinely needed vs composition

| Name | Verdict | Reasoning |
|---|---|---|
| `AppShell` | **REJECT** | Shells exist and are the design: `RoleShell` (web, app-side), `DashboardShell` (ui), `ShellTabBar`/`ShellHeader` (mobile). No contract names AppShell. A unifying wrapper would be architecture-by-component — nothing to build. |
| `MobileHeader` | **REJECT as new; extend `ShellHeader`** | The needed work is wiring, not a component: add `onAvatarPress` (AvatarSheet trigger) to `apps/mobile/components/ShellHeader.tsx` and pass it from every shell layout (the avatar branch is dead code today, C-orphans). Notifications affordance stays out until a contract asks (§8). |
| `ShellHeader` promote-to-ui? | **KEEP app-side** | By the ui-promotions method (§4 WATCH): a single consumer family is not a defect — the trigger is duplication, not headcount; and packages/ui is presentational-only while ShellHeader binds to Expo Router titles + shell resolution. **Caveat the method itself records:** an import census cannot find a copy that never imported anything — Phase 3 must run the similarity check between `ShellHeader` and `packages/app/features/shell/app-header.{native,web}.tsx`; if they turn out to be the same header twice, that *is* the copied-pattern trigger and one promoted header replaces both. |
| `PageHeader` | **REJECT** | No contract names it; web screens compose `Heading` + `Toolbar` under DashboardShell's top bar. If the Phase-3 override census finds a copied heading-row lineage (the ui-promotions §1 Heading story repeating itself), promote then — with the count in hand, not before. |
| `FilterBar` | **BUILD** | §2 row 4 — five cool contracts in one phase window; building once first prevents the five-way copy. |

---

## §6 · Rail grouping — DashboardShell NavGroup extension (doc 36 grouped sets, G §3)

**Not a new component.** `DashboardShell` already ships `NavGroup { title?: string; items: NavItem[] }` with small-caps group labels (hidden on the 112px rail — icons do the grouping there; the label clips rather than wraps, by comment). G §3.2: "the component is ready; only `nav.ts`'s shape and `RoleShell`'s single-group adapter change."

Phase-3 work items:
1. `apps/web/components/site/nav.ts` — `NAV_BY_ROLE` reshapes flat `NavItem[]` → `NavGroup[]` per role: tutor 2 groups per ADR-105 (`Today · My learners · Session notes` / `Incidents · Resources`); org 6 groups per doc 36 §3.4 (Overview / CRM: Leads·Families·Enrollment / Scheduling / Money: Payouts·Invoices / Safety / Settings); district flat 5 per ADR-104 (`Outcomes · Schools · Educators · Compliance · Settings`); school interim exists-only 3 per ADR-103 (`/academics` pulled immediately); teacher inherits the ADR-102 set (stops impersonating tutor).
2. `apps/web/components/site/RoleShell.tsx:420-433` — delete the single-group adapter; pass groups through.
3. Hot shells unaffected (no rail — doc 36 §3.1).
4. Kit-side extension needed: **none identified.** One verify item: active-item matching must work for grouped sub-paths after the `/ops` blob splits into CRM/Money/Safety items (currently one href, soon five under the same prefix) — if `NavItem.active` derivation is caller-side today, it stays caller-side; do not grow the kit for it.
5. Stories: `DashboardShell.stories.tsx` gains a grouped-rail story (labelled groups in menu mode, icon grouping in rail mode) + badge-omission (never render 0) — currently the shipped stories predate grouped consumers.

---

## §7 · Band-variant retrofit list (beyond ProgressBar/MasteryBar)

`ProgressBar` and `MasteryBar` band variants are **owned by the parallel token-system agent** (I-token-system queued item 3) — excluded here to avoid double work. Remaining primitives that must consume `targets`/dial:

| Primitive | Retrofit | Grounding |
|---|---|---|
| `Text` | re-point `variant` values at `uiRamp` tokens (band-dial-aware) instead of the raw Tailwind scale — ui-promotions §2.2, "the single highest-value item"; plus bake `font-mono` into `data` (§2.3) | every learner contract; ui-promotions: 72 call sites reach past the component for ramp behavior it cannot express |
| `Button` / `IconButton` | min-height from `targets` per band (`min-h-target-*`), not a hardcode — "a function of the signed-in child" (I-token §Age-band) | learner.home band table (72/56/48px per band), learner.capture (797-line band-aware flow), doc 36 §3.1 raised-Snap law |
| `Composer` | band targets + voice-first affordance sizing for K–2 | learner.tutor (Natalie session — K–2 voice-first per learner.home K–2 variant row) |
| `TextField` (learner-reachable forms only) | `size` axis honoring band targets (precedent: `OtpField size="xl"` 64dp cells for learners, doc 38 §8) | FD-08, learner.capture inputs |
| `TutorThread` / `MessageBubble` | evaluate during P3-learner: thread density/type already rides `Text` once the ramp re-pointing lands — retrofit only if a residual hardcoded size survives that change | learner.tutor |

Not retrofitted, with reasons: `TabBar` (band handling lives in `(learner)/(tabs)/_layout.tsx` `BAND_ITEMS` + per-band `min-h-target-*` — already the most complete band consumer); `EmptyState` (band-voiced copy is content, not a component axis); `Heading` (bands change size via dial + targets, not typeface — I-token §Typography).

**Gate (ui-promotions §2.4, binding):** the `Text` re-pointing changes rendered type across ~138 consumer files — it ships as its own commit behind a full screenshot pass across both dials and all four age bands, nothing else in that commit. All band retrofits are moot for production until the band-population defect (A-repo-audit (a), `live.tsx:99-104`) is fixed — Phase-2 P0, restated here because every retrofit above would otherwise run at `'teen'` forever.

---

## §8 · Not built — prompt-listed names with zero contract references

Per the rule (no contract → no component), each with its disposition:

| Name | Why not | If demand appears |
|---|---|---|
| `LearningPath` | No contract references a path/map surface; learner.home is resume-first ("one 'next' node" — ADR-107's Duolingo evidence is about singularity, not a path component) | new contract first |
| `LearningCard` / `AssignmentCard` / `StudentCard` / `TutorCard` / `ClassCard` | No contract names any of them; teacher.assign/teacher.classes rows compose `Card` + `List/ListItem` + `Avatar` + `Badge`; resume card composes `Card` + `ProgressBar` | promote after a real copied pattern, with the count (ui-promotions method) |
| Search / ⌘K command | Named only in G §4's utility-bar target map — zero screen contracts reference a search surface; K–2 ban stands regardless | contract + ADR-scale decision |
| Notifications affordance (utility bar / mobile header) | G §4 ✱ + A-repo-audit gap, but no contract binds it; org Safety stays unbadged (doc 31 §5.3) constrains any future design | contract first; composes `IconButton` + `Menu` when it comes |
| `TenantSwitcher` | `ScopeSwitcher` evolves in place, app-side (G §4 start slot); no ui component | — |
| `NavigationRail`, `WebUtilityBar`, `Surface`, `AppShell`, `PageHeader`, `MobileHeader`, `ErrorState`, `Sheet`, `Metric`, `Table`, `Skeleton`, `BottomTabs`, `SessionCard` | Covered by §1 aliases / §5 verdicts / §2.2 retrofits | — |

---

## §9 · Storybook + visual-regression obligations

Per new/changed primitive (conventions from A-repo-audit §Storybook + doc 38 §11):

1. **Co-located story, always** — `<Component>.stories.tsx` next to the component (69 existing files, zero app-owned stories). New *directories* (`ui/stage-board/`) must add their glob to `apps/storybook/.storybook/main.ts` in the same PR — the missing-glob bug has now shipped silently three times (audio, adaptive-panes, layout).
2. **`react-docgen` is off** (RN Flow parse) — stories must demonstrate every variant axis explicitly; no autodocs will save an undocumented prop.
3. **Screenshot matrix** (doc 38 §11): 3 widths (390/820/1440) × 2 dials × ≥2 states per new primitive; learner-facing primitives 390 + 820 only. Band-variant retrofits extend the matrix to all four bands.
4. **Named obligations:** `AvatarSheet` per-role matrix (§3); `StageBoard` board⇄table parity — board view and `DataTable` view rendered from the same fixture set and diffed each release, so the two-views-one-store law stays visually honest; `Banner` tone × dial contrast checks (`check-contrast.mjs` pairs — noting I-token's structural gap: pairs are declared, not derived; add the new tones to the derivation fix, not the declared list); `Text` re-pointing behind the §7 full-matrix gate.
5. **Backlog carried from the audit** (do alongside, not instead): stories for `TutorThread`, `TrendLine`, `ImageViewer`, `ToastCard`, `MoyoLearnLogo`; AdaptivePanes coverage 2/10 must rise as tutor `Learners|detail` (third consumer) lands.

---

## §10 · Top-10 build list (report order)

| # | Component | Where | First phase | Blocking |
|---|---|---|---|---|
| 1 | `AvatarSheet` | ui + app content | P3-guardian | ADR-101 tab fold; every shell's account surface |
| 2 | `StageBoard` | ui (forked) | P3-org | org.crm primary action; doc 28 §3 |
| 3 | `Banner` | ui | P3-guardian | incident banner, entitlement states, offline states |
| 4 | `FilterBar` | ui | P3-org | 5 cool web surfaces |
| 5 | `OtpField` (+ `LearnerCodeEntry`) | ui | P3-FD | FD-05/07/08; teacher rostering |
| 6 | `PlanCard` | ui | P3-FD | FD-13, PW-05, PW-08 |
| 7 | `PasswordField` + `PasswordRules` | ui | P3-FD | FD-02/04/06/07 |
| 8 | `ProfileSwitcher` | app | P3-FD | FD-24; family-device continuity |
| 9 | `RoleChoiceCard` | ui | P3-FD | FD-03/09 |
| 10 | `ChildSwitcher` | app | P3-guardian | G-8 fix; every per-child guardian surface |

(11: `ConsentCheckpoint`, app-side, P3-FD. Retrofits — EmptyState error tone, band variants, NavGroup rewiring — are changes to existing primitives and tracked in §2.2/§6/§7, not builds.)
