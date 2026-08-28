# Accessibility audit: landing chapters 03 / 05 / 06 / 07 / 08 / 09 · WCAG 2.2 AA · 2026-08-28

<!--
Per-screen accessibility pass on the six landing chapters built but never
audited. Chapters 01, 02 and 04 were audited in an earlier pass and are only
referenced here where a shared surface (the header, the skip link, the document
outline) had to be measured to judge these six.
Every number below is measured off the BUILT page under `vite preview`, not read
off the source.
SOT: .claude/skills/accessibility-review · docs/site/tokens.md
     docs/site/motion-matrix.md · docs/site/critique/landing-chapters-03-09.md
SOT-KEYWORDS: a11y accessibility wcag 2.2 aa reflow 320 heading-order landmarks
              contrast targets reduced-motion site chapters web-vite
-->

**Standard:** WCAG 2.2 AA. The `accessibility-review` skill's 7:1 / 56dp
learner overrides do **not** apply — `tokens.md` records that no learner surface
and no child-facing control exists on the marketing site, so every bar below is
the adult AA bar.

**Issues: 9 · Critical: 1 · Major: 7 · Minor: 1 · All 9 closed.**

| # | Issue | Criterion | Severity | Fix |
| --- | --- | --- | --- | --- |
| A1 | Chapter 06's `.parents-underline` was a fixed-attribute `<svg width="320">`. Inside the chapter inset it reached **336px at a 320px viewport**: `document.scrollWidth` 336 vs `clientWidth` 320, i.e. the whole page scrolled horizontally. | **1.4.10 Reflow (AA)** | Critical | Sized in CSS with `preserveAspectRatio="none"` + `vectorEffect="non-scaling-stroke"`. `scrollWidth === clientWidth === 320` asserted. |
| A2 | Chapter 06's plate caption rendered as one run — **"PlaceholderNo photography has been shot for this chapter yet."** `<figcaption>` is `display:block`, so its `gap-stack` was inert and its two inline `Text` children concatenated. Two separate pieces of information presented as one string. | **1.3.1 Info and Relationships (A)** | Major | The pair wrapped in a `View` (the kit's flex box). |
| A3 | Chapter 03: three claim titles at `site-subtitle` were `Text`. | **1.3.1 (A)** | Major | `Heading level={3}`. |
| A4 | Chapter 06: four trust-cell titles at `site-subtitle` were `Text`. | **1.3.1 (A)** | Major | `Heading level={3}`. |
| A5 | Chapter 07: five capability terms at `site-subtitle` and two section titles at `site-title` — **52px at 1440** — were `Text`. | **1.3.1 (A)** | Major | Seven `Heading level={3}`. |
| A6 | Chapter 08: the pricing card's own title, "Family plan", was `Text`. | **1.3.1 (A)** | Major | `Heading level={3}`. |
| A7 | Chapter 09: eleven links in three visually-labelled columns with no programmatic relationship between a column and its label, and **no heading of any level in the entire footer**. | **1.3.1 (A)** | Major | Each `List` is `aria-labelledby` its own column label. |
| A8 | Chapters 05, 06, 07 and 08 each render `role="region"` with no accessible name — four unnamed landmarks in a row — and the footer `<nav>` was the page's second `navigation` landmark, unnamed against the header's "Primary". | 1.3.1 (A) · ARIA20 | Major | `aria-labelledby` on all four sections (matching the pattern chapters 03 and 04 already use), `aria-label="Footer"` on the footer nav. |
| A9 | Chapter 09's mark: the book stroke was left permanently at `stroke-dashoffset: 120px` of a 120px dash at 820 and 1440 — an element authored visible that the page rendered invisible. `aria-hidden`, so no criterion fails; it is logged because it is a direct breach of the project's own end-state law on the motion-ON path. | — (project law) | Minor | Trigger `start: 'top bottom'`. See the critique doc for the measurement. |

---

## Contrast — in use, measured

`tokens.md` pre-measures 28 site pairs at the token level. This audit checks
**which pairs are actually applied to which things**.

| Element | FG | BG | Ratio | Required | Pass |
| --- | --- | --- | --- | --- | --- |
| ch03/06/07/08 body prose | `moyoInkMuted` | `moyoPaper` | 6.91:1 | 4.5:1 | PASS |
| ch05 band eyebrow, headline, deck | `moyoOnPrimary` | `moyoPrimary` | 7.42:1 | 4.5:1 | PASS |
| ch05 truth cards, ch08 card | `moyoInk` | `moyoPaperRaised` | 17.99:1 | 4.5:1 | PASS |
| ch08 renewal disclosure | `moyoInkMuted` | `moyoPaperRaised` | 7.58:1 | 4.5:1 | PASS |
| ch06/07/08 eyebrows, ch07 roadmap line | `moyoSecondary` | `moyoPaper` | 7.06:1 | 4.5:1 | PASS |
| ch07 CRM field | `moyoOnPrimary` | `moyoPrimary` | 7.42:1 | 4.5:1 | PASS |
| ch07 learning-record field | `moyoInk` | `moyoPaperSunken` | 15.00:1 | 4.5:1 | PASS |
| ch08 early-bird date chip | `moyoOnSun` | `moyoSun` | 9.68:1 | 4.5:1 | PASS |
| ch09 legal band | `moyoInkMuted` | `moyoPaperSunken` | 6.32:1 | 4.5:1 | PASS |
| ch09 footer links, wordmark | `moyoInk` | `moyoPaperSunken` | 15.00:1 | 4.5:1 | PASS |
| ch06 price-inset link | `moyoPrimary` | `moyoPaperSunken` | **6.79:1** | 4.5:1 | PASS — **undeclared** |
| ch07 learning-record label, all ch09 eyebrows | `moyoSecondary` | `moyoPaperSunken` | **6.45:1** | 4.5:1 | PASS — **undeclared** |
| every rule, frame and offset shadow | `moyoOutline` | `moyoPaper` / `Sunken` | 16.40 / 15.00:1 | 3:1 | PASS |

**`moyoSun` — fill-only law: held.** Four uses across these six chapters
(ch06 margin marker, ch07 wall marker, ch08 date chip, ch09 sticker). Grepped:
**zero occurrences of `text-moyo-sun` anywhere in the app.** The only one
carrying type is ch08's date chip, and it carries `moyoOnSun` ink at 9.68:1 —
the one foreground the token accepts. No sun border, no sun focus ring.

**The large-text-only pair.** `tokens.md`'s restricted pairing is
`moyoPrimary` on `moyoSun` (4.38:1, `site-hero`/`chapter`/`title`/`subtitle`
only). **It does not occur** in these six chapters — no cobalt type sits on a
sun fill anywhere. `moyoMark` (#0E8B94, the product layer's teal) likewise has
**no consumer on the site layer**: no `text-moyo-mark`, no `bg-moyo-mark`. Both
constraints are satisfied vacuously, which is the correct outcome and is
recorded so a later chapter does not assume otherwise.

**Two undeclared pairs.** `moyoPrimary`/`moyoPaperSunken` and
`moyoSecondary`/`moyoPaperSunken` are shipping and are not in `SITE_PAIRS`, so
`tooling/check-contrast.mjs` is not watching them. Both pass comfortably —
this is a gate gap, not a contrast failure. Ticketed as X-3 in the critique.

## Heading order

One `<h1>`, one `<h2>` per chapter, `<h3>` for every sub-title. **No level is
skipped and no chapter opens below `<h2>`.** After this pass, at both 390 and
1440:

```
h1  hero        Learning has a heart.
h2  desk        A week, as your child actually lived it.
h2  conversation Moyo never just gives the answer…      h3 ×3
h2  chapter-04  Learning has no borders
h2  chapter-05  Meet Natalie.                            h3 ×5
h2  for-parents You'll actually know how it went.        h3 ×4
h2  for-schools The operations cloud under the tutoring. h3 ×7
h2  start       One plan. Every child.                   h3 ×1
```

Before: 7 `<h2>` and **5** `<h3>` (chapter 05 only). After: 7 `<h2>` and 20
`<h3>`. **The 15 new headings are visually identical to the `Text` they
replaced** — `<h3>` arrives with the UA's `font-weight: 700` and
`margin-block: 30px`, and `packages/ui`'s `Heading` resets neither, so each swap
restates `my-0 … font-normal`. Verified in the built page: every new `<h3>`
computes `font-weight: 400`, `margin-top: 0`, and 22/30px (`site-subtitle`) or
32/52px (`site-title`) at 390/1440 — the exact values the `Text` produced.

**The `Text` `md:` trap: checked in the BUILT html, not the source.** Every
element carrying a `text-site-*` class was read back with `getComputedStyle` at
390 and 1440 and bucketed by chapter, step and computed size. Zero elements
resolve to a product-ramp size at either width — no `text-site-*` loses to
`md:text-body-lg` from 768px up, in any of the six chapters, before or after
these edits.

## Landmarks

| Landmark | Name | Verdict |
| --- | --- | --- |
| `banner` (header) | — | Fine; one per page. |
| `navigation` (header) | "Primary" | Fine. |
| `navigation` (footer) | "Footer" | **Fixed** — was unnamed. |
| `main` | — | Fine; one per page. |
| `region` × 8 | hero / desk / conversation / world / tutor-room / parents / schools / start headline | **Fixed** — four of the eight were unnamed. |
| `contentinfo` (footer) | — | Fine; one per page. |

## Targets

WCAG 2.2 **2.5.8 Target Size (Minimum)**, 24 × 24 CSS px, measured at 390.

| Element | Size @390 | Required | Pass |
| --- | --- | --- | --- |
| ch06 "Read the safety policy" / "Read the privacy policy" | 354 × 26 | 24 × 24 | PASS |
| ch06 "See what's included" | 318 × 26 | 24 × 24 | PASS |
| ch07 "Talk to us" | 115 × 64 | 24 × 24 | PASS |
| ch08 "Start learning" | 170 × 63 | 24 × 24 | PASS |
| ch08 "Run a school or a tutoring business?" | 358 × 26 | 24 × 24 | PASS |
| ch09 support-email link | 279 × 49 | 24 × 24 | PASS |
| ch09 sitemap links (11) | 354 × 26 each | 24 × 24 | PASS |
| ch09 "Reduce motion" | 155 × 64 | 24 × 24 | PASS |

Every interactive element in the six chapters clears 24px in both axes with
room. Nothing here is below the bar and nothing depends on the inline-exception.

## Keyboard (web)

| Element | Tab order | Enter / Space | Escape |
| --- | --- | --- | --- |
| ch06 / ch08 / ch09 links | DOM order, top to bottom | native `<a>` activation | n/a |
| ch07 "Talk to us" | in order, before the capability list — the Aside ordering is also the tab ordering | native | n/a |
| ch08 "Start learning" | in order, inside the card | native | n/a |
| ch09 "Reduce motion" | in order | native `<button>`, `aria-pressed` reflects state | n/a |

No dialogs, sheets, menus or focus traps exist in these six chapters, so 2.1.2
and 2.4.3 have nothing to fail on. `--color-focus` resolves to `moyoPrimary`
inside `.moyo-site` — 7.42:1 on the ground, well past 1.4.11's 3:1.

The press affordances on `.schools-cta` and `.start-cta` are bound to
`pointerdown`/`pointerup` only, so a keyboard user gets activation but not the
compress. Not a failure — the control works and is visible — but noted.

## Screen reader

| Element | Announced as | Issue |
| --- | --- | --- |
| ch03 claim annotations ("not from scratch") | "Handwritten note: not from scratch" | None — the annotation is content and carries a real name; the arrow beside it is `aria-hidden`. |
| ch03 graph paper, pencil rule, claim arrows | (nothing) | Correct — decorative, `aria-hidden`. |
| ch05 Natalie plate artwork | (nothing) | Correct — `aria-hidden`, and it deliberately carries no `alt`: there is no image, and a described-but-absent photograph is worse than an honest blank. |
| ch06 plate + caption | "Placeholder" then the caption sentence, as two runs | **Fixed** (A2). |
| ch07 capability table | list of 5, each "heading level 3" + detail | **Fixed** (A5, and the stray `<div>` in the `<ul>`). |
| ch09 sitemap | three lists named Product / Trust / Company | **Fixed** (A7). |
| ch09 mark signature | (nothing) | Correct — the wordmark beside it carries the name. |

## Reduced motion / media

No media on these six chapters — no video, no audio, no autoplay. Captions and
the FD-17 rules do not apply, and the copy deck's one-voice guard is why: the
site plays real baked Natalie audio or it plays nothing.

**End-state check, run against the built page with `prefers-reduced-motion:
reduce`: zero elements in any of the six chapters render at opacity < 0.05,
`visibility: hidden`, or a non-zero `stroke-dashoffset`.** The reduced-motion
page is the finished page — the rule drawn, the wrong path already struck, the
step already seated, the mark fully signed.

The motion-ON path was checked separately and is where A9 was found: every
`draw` target on the page (`.conversation-underline`, `.conversation-arrow` ×6,
`.parents-underline`, `.footer-mark` ×4) now settles at `stroke-dashoffset: 0`
at 390, 820 and 1440, under both a stepped scroll and a wheel scroll. Before the
fix, `.footer-mark`'s first path settled at 120px of a 120px dash at 820 and
1440.

The footer's "Reduce motion" control writes through the same public setter the
OS media-query listener uses, and is gated on `useHydrated` so the first client
paint matches the server byte for byte.

## Zoom and reflow

**320px, asserted rather than eyeballed.** Every element in the document was
measured against the viewport at 320 × 800 after a full scroll:

```
document.scrollWidth  320
document.clientWidth  320
offenders             0
```

The one element the sweep reports is the `sr-only` skip link at `left: -1px,
width: 1px` — the standard visually-hidden clip, which produces no scrollable
overflow in LTR. Before the A1 fix the same sweep returned `scrollWidth 336`
with `.parents-underline` and its `<svg>` spanning x = 16 → 336.

## Verdict

**PASS.** No critical or major finding remains open. One minor (A9) is closed;
the three 🟡 gate/token gaps carried into the critique doc (X-1 `Heading` UA
reset, X-2 eslint `.vercel` ignore, X-3 two undeclared contrast pairs) are
tracked there and none of them is a WCAG failure.
