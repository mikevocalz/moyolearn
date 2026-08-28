# Site component inventory — what `@acme/ui` covers, what must be site-local

<!--
Deliverable 4 of the design-system lane. Decides, per marketing surface, whether
the shared kit already answers it or whether apps/web-vite/src/components/ has to
own it — with a justification per site-local entry, because "the kit didn't feel
right" is how a second design system gets built by accident.
Nothing here is built. This is the map the chapter agents work from.
SOT: packages/ui/index.ts (the component index) · docs/site/tokens.md
SOT-KEYWORDS: site components inventory marketing kit reuse web-vite chapters
-->

Status: inventory only — **nothing in this document has been built** · Date: 2026-08-28

## The rule this inventory applies

`CLAUDE.md`: *"Check for an existing component before creating one. Extend or
compose; never duplicate a near-identical component."* A site-local component is
justified only when one of three things is true:

- **(A) No kit analogue exists** and the need is marketing-only.
- **(B) The kit analogue exists but carries product machinery** the site cannot
  pay for — Zustand stores, Payload types, `protectedOperation`, native modules
  — and stripping it would fork the component rather than reuse it.
- **(C) The kit analogue is right but its variant API cannot express the site's
  type scale**, and adding a `site-*` variant to a product component would put
  marketing concerns inside the product kit.

"It should look different" is **never** a justification: that is what
`.moyo-site` and the token layer are for. Re-point a variable, don't fork a
component.

---

## Already covered by `@acme/ui` — use as-is

These render correctly inside `.moyo-site` with no change, because the scope
re-points the variables they read. Verified end-to-end by the prerendered hero.

| Need | Kit component | Notes for site use |
| --- | --- | --- |
| Page ground / document | `Main`, `Section`, `Article`, `Header`, `Footer`, `Nav` (`@acme/ui/primitives`) | Real semantic HTML through `@expo/html-elements`. Ground comes from `bg-moyo-paper`. |
| Width caps | `Container` (`width="prose\|detail\|wide\|screen"`) | The only place max-widths live. Site chapters use `wide`; prose blocks use `prose`. |
| Prose | `Paragraph` (`@acme/ui/primitives`) | **Use this, not `Text`.** ADR-001 records that `Text` renders as a `<div>`; `Paragraph` carries `role="paragraph"` and emits a real `<p>`. |
| Body / label copy | `Text` | Pass `className="text-site-body"` etc. The `variant` prop stays for the base face and colour. |
| Headings | `Heading` | Works, with the `md:` caveat below — see `MoyoDisplay`. |
| Buttons and links | `Button`, `Link` | `--color-primary` / `--color-on-primary` are re-pointed by `.moyo-site`, so the CTA is cobalt-on-paper with no override. |
| Cards | `Card` | `--radius-card` → `moyoRadius.card`, `--shadow-card` → `shadow-moyo-2` inside the scope. This is the reuse the scope was designed to make free. |
| Images | `Image` | Already handles the RNW/`solito` seam. |
| Brand lockup | `BrandLockup` | The product's own lockup. Marketing must not mint a second one. |
| Two-pane marketing/auth layout | `TwoPaneShell` | Explicitly the auth/marketing split (doc 37 §3.1). Reuse before inventing a hero-split. |
| Lists | `List`, `ListItem` | |
| Long lists | `VirtualList` | Backed by `@legendapp/list` — the repo's only list primitive, never `FlatList`. |
| Accordion / FAQ | `Collapsible` | Covers an FAQ chapter without a new component. |
| Tabs / segmented switching | `SegmentedControl`, `TabBar` | For a "for parents / for schools" register switch. |
| Modal, sheet, lightbox | `Dialog`, `BottomSheet`, `Lightbox` | Note: `Lightbox` for media chapters. |
| Badges / pills | `Badge` | |
| Motion primitives | `Motion`, `FadeIn`, `SlideUp`, `ScaleIn`, `AnimatePresence`, `useReducedMotion`, `PressScale` | **The motion agent must start here.** `useReducedMotion` is already wired; a bespoke motion layer would be a second system. |
| Empty / loading states | `EmptyState`, `LoadingSkeleton` | |
| Forms (waitlist, contact) | `useAppForm`, `FormField`, `TextField`, `Checkbox`, `ErrorMessage` | The kit's form stack. A marketing form is still a form. |
| Reduced-motion + hydration guards | `useHydrated`, `useReducedMotion` | |

## Deliberately NOT for site use

| Kit component | Why not |
| --- | --- |
| `TutorStage`, `TutorThread`, `LearningCanvas`, `SessionToolbar`, `Composer`, `MessageBubble`, `StreamedText` | Product session surfaces. A marketing "see the tutor" chapter renders a *still or video*, never a live session shell. |
| `MasteryBar`, `ProgressBar`, `StatCard`, `ScheduleCard`, `TrendLine`, `DataTable` family | Bound to learner data shapes. A marketing stat is a designed display moment, not a chart. |
| `Dial`, `RoleScope` | Product temperature and role theming. The site has one temperature and no roles; `.moyo-site` is its equivalent and they must not be nested. |
| `adaptive-panes`, `SafeArea`, `KeyboardAwareScroll`, `NativeSlot`, audio exports | Native/app-shell machinery with no marketing meaning. |
| `CoachMark`, `Toast`, `notify` | In-product guidance and feedback. Marketing has no session to guide. |

---

## Must be site-local — `apps/web-vite/src/components/`

Nine entries. Each names its justification class (A/B/C) and the tokens it will
consume, so none of them can quietly invent a value.

| # | Component | Class | Justification | Tokens it consumes |
| --- | --- | --- | --- | --- |
| 1 | `MoyoDisplay` | **C** | `Heading` hard-codes a responsive product step (`text-display-xl md:text-display-2xl`), and tailwind-merge only overrides within the same modifier group — so every site title must currently restate `md:text-site-hero` to beat it (the workaround documented in `routes/index.tsx`). A `site-*` size variant does not belong in a product component. This wraps `Heading` and owns the `site-hero`/`site-chapter`/`site-title`/`site-subtitle` mapping in one place. | `siteTypeScale.*`, `moyoDisplay`, `moyoInk` |
| 2 | `MoyoEyebrow` | **A** | The structural label above every chapter title — caps, tracked, `moyoSecondary`, often paired with a rule. The kit's `Text variant="label"` is a UI label with a different job and a different (dialled) ramp. This is a composition-level device, and it is one of the two places the African structural rhythm is actually expressed. | `site-label`, `moyoSecondary`, `moyoBorderW.hair` |
| 3 | `MoyoRule` | **A** | The separator system: a horizontal rule with a width step and an optional repeat/interval, which is where "rhythm, repetition, modularity" becomes structure rather than a motif. No kit analogue — the kit's borders are component chrome, not a composition element. | `moyoBorderW.*`, `moyoOutline`, `moyoShadowOffset[1]` |
| 4 | `MoyoSlab` | **A** | The neubrutalist frame: outlined block, square corners, zero-blur offset shadow, optional chromatic fill with its matching `on-*` foreground. `Card` is close but is a product card — dialled radius, product elevation, and it will keep moving with product needs. Two different jobs, and the difference is exactly the design language. | `moyoPaperRaised`, `moyoOutline`, `moyoBorderW.*`, `moyoShadowOffset.*`, `moyoRadius.*`, all `moyoOn*` |
| 5 | `MoyoMarginNote` | **A** | The annotation device — Shantell Sans note plus an optional pencil arrow, absolutely placed against a chapter. This is the *only* component allowed to use `font-moyo-hand`, which is precisely why it should exist: a single owner is how "the only handwriting" stays enforceable instead of aspirational. | `moyoHand`, `site-note`, `moyoInkMuted` |
| 6 | `MoyoPullQuote` | **A** | Instrument Serif, "sparingly", plus attribution. The serif has no product analogue at all, and giving it one owner is what keeps "sparingly" from decaying into "everywhere". | `moyoSerif`, `site-quote`, `moyoInk`, `moyoInkMuted` |
| 7 | `MoyoPaperGrain` | **A** | The 2–4% grain overlay that carries the Tactile Learning quarter of the ratio. No kit analogue; needs `pointer-events: none`, correct stacking, and a reduced-motion/`prefers-contrast` opt-out. Single owner keeps it from becoming grunge. | `--moyo-grain-opacity`, `moyoPaper` |
| 8 | `MoyoSeoHead` | **A** | Per-route `head()` composition — title, description, OG, canonical from a single `SITE_ORIGIN`. Currently inline in `routes/index.tsx`; the second route is where it must be extracted or the canonical origin gets spelled twice. Pure marketing/SEO, no product analogue. | none (metadata only) |
| 9 | `MoyoSiteNav` / `MoyoSiteFooter` | **B** | Marketing chrome. `Nav`/`Footer` primitives supply the elements, but the site's header and footer are content structures — nav model, legal links, sitemap. The kit's app shells assume an authenticated session and a role. | `moyoPaper`, `moyoOutline`, `moyoBorderW.hair`, `site-label`, `site-body` |

### Not site-local, despite looking like it

| Candidate | Verdict | Why |
| --- | --- | --- |
| `MoyoButton` | **No** | `Button` already reads `--color-primary` / `--color-on-primary` / `--radius-control` / `--shadow-card`, all of which `.moyo-site` re-points. A site button would be a fork with no behavioural difference — the exact duplication the rule forbids. |
| `MoyoCard` | **No** | Covered by `MoyoSlab` (#4) for the neubrutalist frame and by `Card` for anything tactile. Three card components would be two too many. |
| `MoyoMotion*` | **No** | `@acme/ui`'s motion exports plus `useReducedMotion` cover it. The motion agent extends those. |
| `MoyoGlobe` | **Not mine** | Owned by the globe chapter agent. Recorded here only so its two public colour commitments are traceable: Africa = `moyoSun`, oceans = `moyoPrimary`. |

## Conventions for anything built here

- Header block per file with `SOT:` and `SOT-KEYWORDS:` (`CLAUDE.md`).
- Zustand only if state is needed at all — never `useState`.
- Tokens only. A hex, a `px`, or an arbitrary value in a site component is a lint
  failure, and `docs/site/tokens.md` is where a missing value gets added.
- `tooling/check-references.mjs` scopes its Mobbin citation gate to
  `packages/app/features` and `packages/ui`, so `apps/web-vite/src/components/`
  is **not** gated — but the standing rule still applies. Pull 3–5 references
  before building any of these and cite them in the header anyway.
