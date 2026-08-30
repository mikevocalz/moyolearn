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

Status: inventory only, **except** the motion vocabulary, which ships — see
"The site's motion vocabulary" below · Date: 2026-08-28

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
| Motion primitives | `Motion`, `FadeIn`, `SlideUp`, `ScaleIn`, `AnimatePresence`, `useReducedMotion`, `PressScale` | **Product only — superseded on the site.** See "The site's motion vocabulary" below: the site runs on GSAP, and these `@legendapp/motion` presets are the second system that must not appear on a marketing surface. `useHydrated` from the same module is still used, and the site's reduced-motion store reads the same OS signal these do. |
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
| 5 | `MoyoMarginNote` | **A** | The annotation device — a General Sans note plus an optional pencil arrow, positioned against a chapter. Weight, placement and the arrow carry the annotation voice without loading a third font family. | `moyoText`, `site-note`, `moyoInkMuted` |
| 6 | `MoyoPullQuote` | **A** | Instrument Serif, "sparingly", plus attribution. The serif has no product analogue at all, and giving it one owner is what keeps "sparingly" from decaying into "everywhere". | `moyoSerif`, `site-quote`, `moyoInk`, `moyoInkMuted` |
| 7 | `MoyoPaperGrain` | **A** | The 2–4% grain overlay that carries the Tactile Learning quarter of the ratio. No kit analogue; needs `pointer-events: none`, correct stacking, and a reduced-motion/`prefers-contrast` opt-out. Single owner keeps it from becoming grunge. | `--moyo-grain-opacity`, `moyoPaper` |
| 8 | `MoyoSeoHead` | **A** | Per-route `head()` composition — title, description, OG, canonical from a single `SITE_ORIGIN`. Currently inline in `routes/index.tsx`; the second route is where it must be extracted or the canonical origin gets spelled twice. Pure marketing/SEO, no product analogue. | none (metadata only) |
| 9 | `MoyoSiteNav` / `MoyoSiteFooter` | **B** | Marketing chrome. `Nav`/`Footer` primitives supply the elements, but the site's header and footer are content structures — nav model, legal links, sitemap. The kit's app shells assume an authenticated session and a role. | `moyoPaper`, `moyoOutline`, `moyoBorderW.hair`, `site-label`, `site-body` |

## The site's motion vocabulary — `apps/web-vite/src/motion/` (BUILT)

The one exception to "nothing in this document has been built": the motion
foundation ships. A chapter animates by calling these and nothing else; a
marketing page that reaches for `gsap.to()` directly is inventing a second
design language. Full spec, including the reduced-motion behaviour of every
entry, in `docs/site/motion-matrix.md`.

| What you want | Call | Notes |
| --- | --- | --- |
| Animate anything in a chapter | `useMotionScene(scope, builder, deps)` from `@/motion` | The only entry point. Hands the builder the vocabulary, scopes it with `gsap.context`, and reverts on unmount — which is what keeps ScrollTriggers from leaking across routes. |
| A card arriving | `motion.thunk` | Fast in, 2.5% overshoot, hard settle. |
| A workbook cover | `motion.open` | |
| A sticker | `motion.peel` | Fires once. Never loops. |
| A pencil underline | `motion.draw` | SVG `stroke-dashoffset`; the primitive owns the dash, CSS must not. |
| A wrong approach | `motion.crossOut` | |
| A mastery block | `motion.snap` / `motion.lockIn` | Progress is pieces locking into place. **Never confetti.** |
| A register change | `motion.pageTurn` | |
| A button press | `motion.compress` + the `.moyo-pressable` class | Travel and shadow are `calc()`'d from one token so they cannot drift. |
| The listening mark | `motion.pulse` | Only while Natalie listens. Paired with a live region. |
| A draggable | `motion.inertialTilt` / `motion.bindDragInertia` | |
| A depth layer | `motion.parallax` | The only ambient scroll motion. Use sparingly. |
| A display heading | `motion.splitReveal` | GSAP SplitText, verified present in the installed package. |
| Reduced motion, in a component | `useReducedMotion()` from `@/stores/perf-store` | |
| Reduced motion, outside React | `isReducedMotion()` | For GSAP builders and ticker callbacks. |
| Smooth scroll | nothing — `MotionRuntime` in `__root.tsx` owns it | Lenis drives ScrollTrigger's ticker. Off entirely under reduced motion. |
| See it all working | `/motion-lab` | Every primitive in both motion states. `noindex`, not in the sitemap. |

Two rules a chapter cannot break without breaking the system:

- **Never import `gsap`, `motion/primitives` or `motion/register` directly.**
  They arrive as the `motion` argument. A static import pulls ~48 kB gz of GSAP
  into that route's chunk; the initial-JS margin is under 1 kB.
- **Never author an element hidden.** Markup carries the END state; primitives
  create their own start states in the browser. That is what makes "animates in,
  stays invisible" structurally impossible under reduced motion and with JS off.

### Not site-local, despite looking like it

| Candidate | Verdict | Why |
| --- | --- | --- |
| `MoyoButton` | **No** | `Button` already reads `--color-primary` / `--color-on-primary` / `--radius-control` / `--shadow-card`, all of which `.moyo-site` re-points. A site button would be a fork with no behavioural difference — the exact duplication the rule forbids. |
| `MoyoCard` | **No** | Covered by `MoyoSlab` (#4) for the neubrutalist frame and by `Card` for anything tactile. Three card components would be two too many. |
| `MoyoMotion*` | **Superseded** | This entry predated the §10 spec. The site does NOT extend `@acme/ui`'s `@legendapp/motion` presets: §10 fixes one animation system, GSAP, and two would be the failure the rest of this document exists to prevent. The vocabulary is in `apps/web-vite/src/motion/` and there is still no `MoyoMotion` component — motion is a hook, not a wrapper. |
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
