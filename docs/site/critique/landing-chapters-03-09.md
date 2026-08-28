# Design critique: landing chapters 03 / 05 / 06 / 07 / 08 / 09

<!--
The second critique pass on moyolearn.com's landing page. The first pass
(landing-layout.md) covered chapters 01, 02 and 04 and is NOT re-litigated here.
Judged from screenshots of the BUILT page at 390 / 820 / 1440, plus measured DOM
geometry where the eye cannot adjudicate (overflow, trigger reachability,
computed type steps).
SOT: docs/site/tokens.md · docs/site/motion-matrix.md · docs/site/copy-deck.md
     docs/site/critique/landing-layout.md (the binding layout rule)
SOT-KEYWORDS: site critique chapters conversation tutor-room parents schools
              start footer collision reflow heading-order web-vite
-->

**Reviewed:** built page (`pnpm --filter web-vite build` → `preview`) at
390 × 900, 820 × 900 and 1440 × 900, plus a reduced-motion pass at 1440.
**Date:** 2026-08-28 · **Branch:** `main` · **Evidence:**
`docs/site/critique/shots/` — 24 chapter screenshots, `<chapter>-<width>.png`
and `<chapter>-1440-reduced.png`.

**Verdict.** These six chapters do not repeat the collision failure of the first
pass. There is no text over text and no text over a filled shape it does not sit
inside, at any of the three widths. What they have instead is a **semantics**
problem: four of the six were composed entirely out of `Text` at heading sizes,
so a page that reads as eight titled chapters exposed one `<h1>`, seven `<h2>`s
and — outside chapter 05 — nothing below them. Plus one hard reflow failure, one
caption that shipped as an unreadable run of two strings, and one motion trigger
that could not be reached at two of the three widths.

Nine 🔴 found. **Nine 🔴 fixed.** Eleven 🟡 ticketed below.

---

## Chapter 03 · THE CONVERSATION

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C3-1 | 🔴 | The three claim titles — "Natalie remembers", "Guardrailed for kids", "Every session comes back to you" — are set at `site-subtitle` in Clash Display and are `Text`. The chapter's whole lower half has no programmatic structure; a reader navigating by heading gets the chapter title and then silence. | **FIXED** — `Heading level={3}`, weight and margin neutralised so the rendering is byte-identical (see X-1). |
| C3-2 | 🟡 | At 1440 the right column ends at roughly 40% of the left column's height and leaves a ~500px empty field bottom-right. The Zellerfeld emptiness elsewhere on the page is *composed*; this one is residue from a `lg:w-5/12` that ran out of content. | Ticket. A layout change, not a defect — the column carries the OpenAI verbatim-prompt move and shortening it would cost the move. |
| C3-3 | 🟡 | `.conversation-reply`'s `-translate-y-1/4` pulls the card up over the work but leaves its full height in flow, so the gap *below* it is a quarter-card too large at every width. The attachment move is right; it is paid for twice. | Ticket — the correction is a negative block-end margin, which is a layout decision the composition owner should make. |
| C3-4 | 🟢 | The hand-drawn claim arrows curve down-right into whitespace rather than toward the title they annotate. | Leave. |

**What works.** The Grammarly diff is the best thing in these six chapters: the
learner's wrong path stays on the page under a graphite strike, the correct step
seats in as a leaf block, and the reply card physically attaches to the work.
Verified at 390, 820 and 1440 — the reply card clears the leaf lock-in step at
all three; there is no collision here, only depth.

## Chapter 05 · THE TUTOR ROOM

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C5-1 | 🔴 | The `<section>` renders `role="region"` with no accessible name. Chapters 01–04 all name theirs from the chapter headline; this one, and 06/07/08, did not — four unnamed landmarks in a row. | **FIXED** — `aria-labelledby="tutor-room-headline"`. |
| C5-2 | 🟡 | At 1440 the first truth card's title wraps to four lines against two for its siblings, so the three columns share no baseline and the row reads as three unrelated cards. | Ticket. The string is copy-deck `site.room.voice.title` and may not be edited; the fix is a `text-balance` or a column-width change, both composition calls. |
| C5-3 | 🟡 | This chapter's `<h3>`s carry the UA's `font-weight: 700` and `margin-block: 30px` — see X-1. Pre-existing, and the reason its cards sit on a looser rhythm than chapter 06's. | Ticket (X-1). |
| C5-4 | 🟢 | The plate straddling the cobalt band's bottom edge is the strongest single composition move on the page. Keep it exactly as it is. |

## Chapter 06 · FOR PARENTS

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C6-1 | 🔴 | `.parents-underline` was a raw `<svg width="320" height="16">`. Inside the chapter's own inset it reached **336px in a 320px viewport** and put the entire document into horizontal scroll — `document.scrollWidth` 336 against `clientWidth` 320. WCAG 2.2 **1.4.10 Reflow**. | **FIXED** — sized in CSS (`h-4 w-full max-w-content-detail`, `preserveAspectRatio="none"`, `vectorEffect="non-scaling-stroke"`), which is the PencilRule pattern `conversation.tsx` already established. |
| C6-2 | 🔴 | The plate's caption shipped reading **"PlaceholderNo photography has been shot for this chapter yet."** `<figcaption>` is `display: block`, so `gap-stack` on it was inert, and its two `Text` children render as inline spans and concatenate. Two strings, one unreadable run — at all three widths. | **FIXED** — the pair now sits in a `View`, which is the kit's flex box and keeps the gap it is given. |
| C6-3 | 🔴 | The four trust-cell titles are `Text` at `site-subtitle`. Same defect as C3-1. | **FIXED** — `Heading level={3}`. |
| C6-4 | 🔴 | Unnamed `role="region"`. | **FIXED** — `aria-labelledby="parents-headline"`. |
| C6-5 | 🟡 | `<Figure className="parents-plate gap-stack">` has the same inert gap as C6-2 — the caption sits flush against the plate's 6px offset shadow instead of a stack step below it. Legible, so not 🔴, but it is the same bug one node up. | Ticket. |
| C6-6 | 🟡 | At 1440 the "Honest, not flattering" cell leaves ~200px of dead column under a three-line paragraph, because the trust row stretches every cell to the tallest. In a chapter whose argument is *whitespace as luxury* this reads as an accident rather than a decision — the emptiness is not aligned to anything. | Ticket. |

**What works.** The register turn is real and it lands: the hairline opening
rule, the Instrument Serif standfirst at a 65ch measure, the rules-not-boxes
trust grid. This chapter looks like it was written rather than sold.

## Chapter 07 · FOR SCHOOLS

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C7-1 | 🔴 | The capability table's closing rule was a `View` rendered as a `<div>` **inside the `<ul>`**, as a sibling of the `<li>`s. Invalid HTML, and assistive technology that honours the list announces a stray sixth child. | **FIXED** — the rule moved after the `List`; it renders identically. |
| C7-2 | 🔴 | Five capability terms at `site-subtitle` and two section titles at `site-title` — **52px at 1440**, the largest type in the chapter after the opener — are all `Text`. A 52px line that is not a heading is the clearest 1.3.1 failure on the page. | **FIXED** — seven `Heading level={3}`. |
| C7-3 | 🔴 | Unnamed `role="region"`. | **FIXED** — `aria-labelledby="schools-headline"`. |
| C7-4 | 🟡 | The duotone's "wall" does not read as a wall. Its 4px ink rule is flush against the cobalt field's right edge — so it reads as that block's drop shadow — while the learning-record field sits ~190px away. The graphic's entire claim is that the two sides are *symmetrically* separated, and the composition is asymmetric. | Ticket. The rule is drawn and measured (`border-left: 4px moyoOutline`, confirmed in the DOM at 1440); it is the gutter distribution that is wrong. |
| C7-5 | 🟢 | The Büro rail plus The Leap's bordered rows is the best information design on the page, and the roadmap line sitting as a sibling of the LTI detail is exactly right. | Leave. |

## Chapter 08 · START

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C8-1 | 🔴 | "Family plan" — the card's own title — is `Text`. | **FIXED** — `Heading level={3}`. |
| C8-2 | 🔴 | Unnamed `role="region"`. | **FIXED** — `aria-labelledby="start-headline"`. |
| C8-3 | 🟡 | The struck `$15.99` and the live `$11` share a size class, a face and a baseline and differ only by `moyoInkMuted` + `line-through`. At 390 the struck figure is the wider object and reads first. Craft's geometry was adopted; Craft's weight contrast was not. | Ticket — a weight step on the live price is a design decision, and doc 08's "one display moment per screen" is already spent on the opener. |
| C8-4 | 🟢 | `moyoSun` carrying `moyoOnSun` ink at 9.68:1 on the one unresolved value in the chapter is the correct, and correctly rationed, use of the fill-only token. |

**What works.** One card, no toggle, nothing pre-selected, no countdown, the
renewal disclosure at body size in `moyoInkMuted` above the fold of the card
rather than as the faintest type on the page. The refusals in this chapter are
the product.

## Chapter 09 · FOOTER

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| C9-1 | 🔴 | **The mark's first stroke never drew at 820 or 1440.** The book path shipped at `stroke-dashoffset: 120px` of a 120px dash — invisible for the life of the page — while the M, the heart and the path drew normally. Deterministic, both scroll directions, both widths. Cause: the default enter threshold is `top 78%` and the mark sits ~200px above the END of the document, so at maximum scroll its top never crosses it. Measured, 900px viewport: **390 → 67% (fires) · 1440 → 75% (marginal) · 820 → 80% (never fires).** | **FIXED** — `start: 'top bottom'` on this one scene. An entry threshold expressed as a fraction of the viewport is the wrong instrument for an element nothing can be scrolled past. Chapter-scoped: no shared primitive was changed. |
| C9-2 | 🔴 | Eleven links in three visually-labelled columns with no programmatic relationship between a column and its label, and **no heading of any level anywhere in the footer**. To a screen reader it was one flat run of eleven. | **FIXED** — each `List` is now `aria-labelledby` its own column label. `Heading` was the wrong instrument here and was tried and rejected: its base is `font-display` and it carries no `uppercase`, so it would have re-set Product / Trust / Company in Clash Display and destroyed the eyebrow. |
| C9-3 | 🔴 | The footer `<nav>` is the page's second `navigation` landmark and was unnamed against the header's "Primary". | **FIXED** — `aria-label="Footer"`. |
| C9-4 | 🟡 | The desk-clutter strip uses `px-6` — the only raw spacing utility in these six chapters. Everything else is `p-inset-*`. The block widths beside it are documented as object geometry and are fine; the padding is not geometry, it is a spacing tier. | Ticket. |
| C9-5 | 🟡 | The wordmark is set at `text-site-chapter`, the step `tokens.md` reserves for chapter openers, which makes the footer the ninth chapter opener on the page. Vucko's "the mark is the footer's mass" is right; the ramp step is borrowed. | Ticket. |
| C9-6 | 🟢 | A reduced-motion toggle in the footer, wired through the same public setter the OS media query uses, is the correct call and it works. |

---

## Cross-cutting

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| X-1 | 🟡 | **`packages/ui`'s `Heading` resets neither UA style.** Every `<h3>` on the site arrives with `font-weight: 700` and `margin-block: 30px` — measured. Chapter 05 ships that today. The four chapters converted in this pass neutralise it per call site with `my-0 … font-normal`, which is a workaround: the fix belongs in the `tv` base, and would let five call sites drop two classes each. | Ticket. |
| X-2 | 🟡 | `apps/web-vite/eslint.config.mjs` ignores `dist/**`, `.output/**` and `.tanstack/**` but not `.vercel/**`, so `pnpm --filter web-vite lint` reports ~11,000 errors in minified build output on any machine that has run a Vercel build. `.vercel` is gitignored, so CI is unaffected and this was NOT touched — but it makes the local gate unusable. | Ticket (one entry, beside `.output/**`). |
| X-3 | 🟡 | Three site colour pairs are **in use and undeclared** in `SITE_PAIRS`: `moyoPrimary`/`moyoPaperSunken` (6.79:1, ch06's price inset link), `moyoSecondary`/`moyoPaperSunken` (6.45:1, ch07's learning-record label and every ch09 footer eyebrow). All three pass AA comfortably — but `tokens.md`'s own principle is that a pairing nobody declares is a pairing nobody measures, and the `check-contrast` gate is not watching these. | Ticket. |

## Not a defect — recorded so it is not chased again

Element-level screenshots of every chapter show the sticky header lying across
the chapter's opening lines. **It does not do that in use.** Measured across all
six anchors at 390 and 1440, after a real `#anchor` navigation the target's top
lands **7–10px below the header's bottom edge** — the document already carries
the scroll offset. The overlap is an artefact of `element.screenshot()`, which
scrolls the element to the viewport top without it.

## Status

🔴 9 found · **9 fixed** · 🟡 11 ticketed (C3-2, C3-3, C5-2, C6-5, C6-6, C7-4,
C8-3, C9-4, C9-5, X-1, X-2, X-3) · 🟢 4 left.

Chapters 01, 02 and 04 were not re-reviewed. **No fix in this pass touches
them**: every change is inside the six chapter files, and the one shared-motion
change that was attempted (`invalidateOnRefresh` in `compose()`) was measured,
found to make C9-1 worse rather than better, and reverted — `primitives.ts` is
byte-identical to how this pass found it.
