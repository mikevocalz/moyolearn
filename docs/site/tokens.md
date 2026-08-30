# Site tokens — moyolearn.com · §5.1 colour + shape · §5.2 type

<!--
The marketing site's design-system layer, written to the `design-system` skill's
format. Every value here is emitted by packages/theme/build-css.mjs from
packages/theme/tokens.ts — this file documents and measures, it never defines.
Contrast ratios are produced by tooling/check-contrast.mjs, which gates them in
`pnpm lint`, so the numbers below cannot drift from the palette without the
build failing first.
SOT: packages/theme/tokens.ts · packages/theme/theme.css (generated)
SOT-KEYWORDS: site tokens marketing moyo paper ink contrast wcag type clamp fonts
-->

Status: implemented · Date: 2026-08-28 · Gate: `pnpm lint` (`check-contrast`,
`check-utilities`, `check-runtime-classes`)

## What this layer is, and what it is not

This is **not a second design system**. It is a semantic layer inside the repo's
existing token pipeline — the same `tokens.ts` → `build-css.mjs` →
`theme.css` chain the product uses — that names the marketing site's own ground,
palette, shape and type.

Three properties define it:

| Property | Value | Why |
| --- | --- | --- |
| Theme-independent | Flat hex, no `light-dark()` | The site has one ground: warm cream paper. Phase 0's hero sat on `bg-surface` and inverted itself on a dark-mode machine, which took the hard offset shadows — drawn in the outline colour — with it. |
| Web output only | `theme.css`, never `theme-native.css` | There is no native marketing surface. Emitting these into Uniwind's registry would ship utilities the mobile app can never use. |
| Camel in TS, kebab in CSS | `moyoPrimary` → `--color-moyo-primary` → `bg-moyo-primary` | The §5.1 names are binding, the file's variables are kebab. `build-css.mjs` converts once (`kebab()`) rather than the name being written twice and drifting. |

**Tokens only.** No raw value belongs downstream. If a value is missing, it is
added to `packages/theme/tokens.ts` — never inlined at a call site.

## The design language these tokens serve

60% Editorial Neubrutalism · 25% Tactile Learning · 15% Spatial Magic. The ratio
is held by *what the tokens make cheap*: heavy display type and hard zero-blur
offsets are one class each, paper grounds and 2–4px rules are the defaults, and
there is exactly one small radius so nothing can drift soft. African influence is
**structural** — it lives in the rhythm the border-width and offset ladders
impose on grids, separators and section transitions, not in a motif. If a
reviewer can point at a decoration and say "that's the African part", this layer
was used wrong.

There is no token for a blurred shadow, a glassmorphic surface, a gradient, or a
neon accent. That absence is the enforcement.

---

## §5.1 Colour

### Ground and ink

| Token | Value | Utility | Usage rule |
| --- | --- | --- | --- |
| `moyoPaper` | `#F7F1E3` | `bg-moyo-paper` | **The ground.** Every page starts here. Warm cream, never white — the site is printed matter, not a screen. |
| `moyoPaperRaised` | `#FFFCF2` | `bg-moyo-paper-raised` | A card or slab lifted off the ground. Pairs with an outline and an offset shadow, never with a blur. |
| `moyoPaperSunken` | `#EFE7D4` | `bg-moyo-paper-sunken` | A recessed band. The only way a section may change value without changing hue. |
| `moyoInk` | `#171310` | `text-moyo-ink` | All primary type. Never `#000`: pure black on cream reads as a printing fault. |
| `moyoInkMuted` | `#5A5145` | `text-moyo-ink-muted` | Secondary prose, captions, metadata. Muted is a **value** step, never a legibility cut — it still clears AA on all three grounds. |
| `moyoOutline` | `#171310` | `border-moyo-outline` | Every rule, frame and offset shadow. The outline *is* the ink; the token is separate so a section can soften its rules without touching type colour. |

### The logo hues

| Token | Value | Utility | Usage rule |
| --- | --- | --- | --- |
| `moyoPrimary` | `#3C2357` | `bg-`/`text-moyo-primary` | **Logo plum.** Links, labels, the primary action and structural fills. Safe as body text on paper (11.88:1). |
| `moyoSecondary` | `#3C2357` | `text-moyo-secondary` | The same plum in an annotation role. The semantic alias keeps hierarchy explicit without adding another hue. |
| `moyoHeart` | `#E55545` | `bg-moyo-heart` | **Logo coral. FILL ONLY.** Dark ink on it is 5.03:1; coral itself is not body text on paper. |
| `moyoSun` | `#F4A629` | `bg-moyo-sun` | **Logo orange. FILL ONLY.** Dark ink on it is 9.09:1. |
| `moyoMark` / `moyoLeaf` | `#0A9FA6` | `bg-moyo-mark` / `bg-moyo-leaf` | **Logo teal. FILL ONLY.** Dark ink on it is 5.74:1. |
| `moyoMarkDeep` | `#3C2357` | `bg-`/`text-moyo-mark-deep` | Identity alias for the logo plum. |

### Foregrounds

Paper rather than white on every chromatic fill: a white knockout on a cream page
reads as a hole punched through it.

| Token | Value | Rides on | Usage rule |
| --- | --- | --- | --- |
| `moyoOnPrimary` | `#F7F1E3` | `moyoPrimary` | Cream type or icons on plum. |
| `moyoOnSecondary` | `#F7F1E3` | `moyoSecondary` | Cream type on plum. |
| `moyoOnHeart` | `#171310` | `moyoHeart` | Ink on coral. |
| `moyoOnSun` | `#171310` | `moyoSun` | Ink on orange. |
| `moyoOnEarth` | `#171310` | `moyoEarth` | Ink on coral. |
| `moyoOnLeaf` / `moyoOnMark` | `#171310` | teal fills | Ink on teal. |

### Shape and elevation

| Token | Value | Utility | Usage rule |
| --- | --- | --- | --- |
| `moyoShadowOffset[1]` | `0.1875rem` (3px) | `shadow-moyo-1` | A rule that has just lifted off the page. |
| `moyoShadowOffset[2]` | `0.375rem` (6px) | `shadow-moyo-2` | The default card. |
| `moyoShadowOffset[3]` | `0.625rem` (10px) | `shadow-moyo-3` | A hero slab. |
| `moyoShadowOffset[4]` | `1rem` (16px) | `shadow-moyo-4` | At most one per page. |
| — | — | `--moyo-shadow-offset-N` | The bare scalar, for a chapter that interpolates depth. Re-deriving it by parsing the composed string is how a second source of truth gets born. |
| `moyoBorderW.hair` | `2px` | `border-moyo-hair` | The floor. Below 2px a frame stops reading as drawn. |
| `moyoBorderW.rule` | `3px` | `border-moyo-rule` | Section separators and card frames. |
| `moyoBorderW.slab` | `4px` | `border-moyo-slab` | A display frame carrying a hero. |
| `moyoRadius.square` | `0rem` | `rounded-moyo-square` | **The default.** Mostly square is the law. |
| `moyoRadius.card` | `0.25rem` (4px) | `rounded-moyo-card` | The ONE soft step, for tactile cards. A third entry would turn a law into a scale. |
| `moyoTexture.grain` | `0.03` | `--moyo-grain-opacity` | Paper grain. 2–4% is the entire range; at 5% it is grunge and the language is a clean workbook, not a distressed poster. |

**Every offset shadow has zero blur, always.** There is no token for a blurred
shadow because a blurred shadow is a different design language.

Border width is declared as real classes in `@layer base`, not as utilities:
Tailwind builds `border-2` from a bare number and has no border-width theme
namespace, so a `border-moyo-rule` *utility* would be generated by nothing and
silently do nothing — the exact failure `tooling/check-runtime-classes.mjs`
exists to catch.

### `.moyo-site` — the ground, made explicit

The site must not inherit the app's dark mode. `packages/theme/build-css.mjs`
emits a `.moyo-site` scope, carried on `<body>` in
`apps/web-vite/src/routes/__root.tsx`, that does two things:

1. `color-scheme: light` — fixes how every product `light-dark()` token
   *resolves* inside the subtree, covering tokens this scope does not name.
2. Unconditional re-points — `--color-surface`, `--color-text`, `--color-border`,
   `--radius-card`, `--shadow-card`, `--font-display`, `--font-sans` and the
   accent pair now resolve to site values. These hold even where a value never
   passes through a CSS engine: `react-native-css` compiles kit components to
   inline styles, and a `var()` survives that where a `light-dark()` resolution
   would not.

Scoped like `.dial-*` and `.role-*`, for the same reason: one class on the
document lets every `@acme/ui` component inside render on paper **without a
single one of them being restyled at the call site.**

---

## §5.2 Type

### Faces

Self-hosted woff2 in `apps/web-vite/public/fonts/`, declared in
`apps/web-vite/src/fonts.css`. **No CDN font request is emitted** — verified by
grepping the built stylesheet and the prerendered HTML for
`fonts.googleapis.com` / `fonts.gstatic.com`: zero hits in both.

| Token | Utility | Face | File (on disk) | Usage rule |
| --- | --- | --- | --- | --- |
| `moyoDisplay` | `font-moyo-display` | Clash Display 200–700 var. | `ClashDisplay-Variable.woff2` · 29 kB | Hero and chapter titles only. Tight tracking. Never body, never UI. |
| `moyoText` | `font-moyo-text` | General Sans 200–700 var. | `GeneralSans-Variable.woff2` · 37 kB | Everything the reader actually reads, plus all UI. |

Total active webfont weight is 66 kB across two variable files. The site uses
one display voice and one reading/UI voice; quote and note hierarchy now comes
from scale, weight and placement rather than two additional font personalities.

**Licence — both permit self-hosting.** The text ships beside the binaries.

| Face | Licence | Self-hosting | Evidence |
| --- | --- | --- | --- |
| Clash Display, General Sans | ITF Free Font License v2.0 | Permitted and recommended | `public/fonts/ITF-Free-Font-License.txt` §01: "You may self-host Font Software on own servers … including through standard webfont technologies such [as] CSS @font-face." Free for commercial use, no attribution required, Fontshare API explicitly optional. |

### CLS ≈ 0 — the measured fallback metrics

Every face is `font-display: swap`, so text is readable immediately. The swap
does not reflow because each real face is shadowed by a `local()`-backed
`* Fallback` face carrying `size-adjust` plus ascent/descent/line-gap overrides.

Method: `size-adjust = webfont avg glyph width ÷ fallback avg glyph width`, where
average width is the English-letter-frequency-weighted mean of `hmtx` advances
(the `fontaine`/`next/font` method). Overrides
are the real face's own `hhea` values divided by `unitsPerEm` and by
`size-adjust`. Measured with `fontTools` 4.61.1 against the shipped woff2 files
and the system fallback binaries.

| Face | Fallback | `size-adjust` | `ascent-override` | `descent-override` | `line-gap-override` |
| --- | --- | --- | --- | --- | --- |
| Clash Display | Arial | 111.9% | 79.54% | 22.34% | 8.04% |
| General Sans | Arial | 109.83% | 91.96% | 21.85% | 9.1% |

**Do not hand-edit these percentages.** Remeasure if a font file is replaced.

Only Clash Display is preloaded (`__root.tsx`): it sets the hero, so it is on the
critical path by definition, and a second preload would compete for the same
connection while nothing above the fold needed it. The `href` and the `@font-face`
`src` are byte-identical strings — that is why the files live in `public/` and not
in the Vite module graph, whose hashed URL cannot be spelled from the route file.
`crossOrigin` is present because fonts are always fetched in CORS mode; a preload
without it is a second, unmatched request.

### The fluid ramp

Every step is a `clamp()`, so there is no breakpoint at which type jumps — the
page is one continuous composition from 320px to 2560px. Leading tightens as size
grows because a 200px line set at 1.2 leaves a corridor no layout can absorb.

| Token | Utility | Size | Leading | Tracking | Usage rule |
| --- | --- | --- | --- | --- | --- |
| `site-hero` | `text-site-hero` | `clamp(4rem, 12vw, 12.5rem)` | 0.88 | -0.03em | **One per page.** Clash Display. This is the spec's `clamp(64px, 12vw, 200px)`. |
| `site-chapter` | `text-site-chapter` | `clamp(2.75rem, 7vw, 6.5rem)` | 0.95 | -0.025em | Chapter openers. Clash Display. |
| `site-title` | `text-site-title` | `clamp(2rem, 4vw, 3.25rem)` | 1.05 | -0.02em | Section titles. |
| `site-subtitle` | `text-site-subtitle` | `clamp(1.375rem, 2.4vw, 1.875rem)` | 1.15 | -0.01em | Sub-headings inside a section. |
| `site-lead` | `text-site-lead` | `clamp(1.125rem, 1.6vw, 1.375rem)` | 1.5 | 0 | The paragraph directly under a display moment. |
| `site-body` | `text-site-body` | `clamp(1rem, 1.05vw, 1.125rem)` | 1.6 | 0 | Prose. General Sans. |
| `site-label` | `text-site-label` | `clamp(0.8125rem, 0.9vw, 0.875rem)` | 1.3 | 0.08em | Eyebrows and structural labels. Tracked open because it is set in caps. **13px is the floor** — nothing goes below it. |
| `site-quote` | `text-site-quote` | `clamp(1.5rem, 3vw, 2.5rem)` | 1.2 | -0.01em | Display-weight pull quote. |
| `site-note` | `text-site-note` | `clamp(0.9375rem, 1.1vw, 1.0625rem)` | 1.45 | 0 | General Sans annotation. |

**Every step is registered in `RAMP_FONT_SIZES` (`packages/ui/tv.ts`).** Adding a
step without registering it means tailwind-merge classifies `text-site-*` as a
COLOUR and deletes it whenever the element also sets a text colour — invisible in
review, catastrophic on the page. `check-runtime-classes.mjs` now gates
`siteTypeScale` alongside `uiRamp` and `typeScale`.

---

## Contrast — measured, not eyeballed

WCAG 2.1 relative luminance, sRGB. Produced and gated by
`tooling/check-contrast.mjs` (`SITE_PAIRS`), which runs in `pnpm lint`. **28 site
pairs, 0 failures**, on top of the product layer's 64.

Bars: `4.5:1` = AA body text · `3:1` = AA large text (≥18.66px bold / ≥24px) and
WCAG 1.4.11 non-text boundaries.

| Foreground | Background | FG | BG | Ratio | Required | Pass |
| --- | --- | --- | --- | --- | --- | --- |
| `moyoInk` | `moyoPaper` | #171310 | #F7F1E3 | **16.40:1** | 4.5:1 | PASS |
| `moyoInk` | `moyoPaperRaised` | #171310 | #FFFCF2 | **17.99:1** | 4.5:1 | PASS |
| `moyoInk` | `moyoPaperSunken` | #171310 | #EFE7D4 | **15.00:1** | 4.5:1 | PASS |
| `moyoInkMuted` | `moyoPaper` | #5A5145 | #F7F1E3 | **6.91:1** | 4.5:1 | PASS |
| `moyoInkMuted` | `moyoPaperRaised` | #5A5145 | #FFFCF2 | **7.58:1** | 4.5:1 | PASS |
| `moyoInkMuted` | `moyoPaperSunken` | #5A5145 | #EFE7D4 | **6.32:1** | 4.5:1 | PASS |
| `moyoPrimary` | `moyoPaper` | #3C2357 | #F7F1E3 | **11.88:1** | 4.5:1 | PASS |
| `moyoPrimary` | `moyoPaperRaised` | #3C2357 | #FFFCF2 | **13.03:1** | 4.5:1 | PASS |
| `moyoSecondary` | `moyoPaper` | #3C2357 | #F7F1E3 | **11.88:1** | 4.5:1 | PASS |
| `moyoSecondary` | `moyoPaperRaised` | #3C2357 | #FFFCF2 | **13.03:1** | 4.5:1 | PASS |
| `moyoOnPrimary` | `moyoPrimary` | #F7F1E3 | #3C2357 | **11.88:1** | 4.5:1 | PASS |
| `moyoOnSecondary` | `moyoSecondary` | #F7F1E3 | #3C2357 | **11.88:1** | 4.5:1 | PASS |
| `moyoOnHeart` | `moyoHeart` | #171310 | #E55545 | **5.03:1** | 4.5:1 | PASS |
| `moyoOnSun` | `moyoSun` | #171310 | #F4A629 | **9.09:1** | 4.5:1 | PASS |
| `moyoOnEarth` | `moyoEarth` | #171310 | #E55545 | **5.03:1** | 4.5:1 | PASS |
| `moyoOnLeaf` | `moyoLeaf` | #171310 | #0A9FA6 | **5.74:1** | 4.5:1 | PASS |
| `moyoOutline` | `moyoPaper` | #171310 | #F7F1E3 | **16.40:1** | 3:1 | PASS |
| `moyoOutline` | `moyoPaperRaised` | #171310 | #FFFCF2 | **17.99:1** | 3:1 | PASS |
| `moyoOutline` | `moyoPaperSunken` | #171310 | #EFE7D4 | **15.00:1** | 3:1 | PASS |
| `moyoOutline` | `moyoSun` | #171310 | #F4A629 | **9.09:1** | 3:1 | PASS |
| `moyoPrimary` | `moyoSun` | #3C2357 | #F4A629 | **6.58:1** | 4.5:1 | PASS |

### Restricted and forbidden pairings

| Pairing | Ratio | Rule |
| --- | --- | --- |
| Coral, orange or teal as body text on paper | 1.80–3.25:1 | **Forbidden.** These logo colors are fills; use dark ink on top. |
| `moyoInk` on `moyoPrimary` | 1.38:1 | **Forbidden.** Plum fills carry `moyoOnPrimary`. |
| Paper on coral, orange or teal | 1.98–3.57:1 | **Forbidden.** These fills carry dark ink. |

### Not covered here

The learner-surface 7:1 override in the `accessibility-review` skill does **not**
apply: no learner surface renders on the marketing site, and no child-facing
copy or control exists in this layer. Every pair above is measured at the AA
adult bar.

Focus rings, target sizes, keyboard order and reduced motion are screen-level
findings, not token-level ones. They belong to the per-screen
`accessibility-review` pass when chapters land. What this layer guarantees is
that `--color-focus` inside `.moyo-site` resolves to `moyoPrimary`, which is
11.88:1 against the ground — a ring that remains clearly visible.

---

## Do / don't

**Do**

- Start every page on `bg-moyo-paper`, inside `.moyo-site`.
- Use one `text-site-hero` per page and one `moyoHeart` moment per page.
- Reach for `moyoSun` when you want a block, `moyoSecondary` when you want a mark.
- Let hierarchy come from size, weight and space. Rules are structure.
- Add a token here when one is missing.

**Don't**

- Don't put type, a border or a focus ring in `moyoSun`.
- Don't set body copy in `moyoHand` — it is margin annotation, and nothing else.
- Don't add a second radius step, or any blurred shadow.
- Don't write a raw hex, px or arbitrary value in a site component.
- Don't restyle an `@acme/ui` component at the call site to make it fit the site.
  Re-point a variable in `.moyo-site` instead, so every instance moves together.
- Don't reference a `light-dark()` product token expecting it to follow the OS.
  Inside `.moyo-site` it will not, and that is deliberate.

## Usage — from `apps/web-vite/src/routes/index.tsx`

```tsx
<Main className="min-h-screen bg-moyo-paper py-section">
  <Section>
    <Container width="wide" className="gap-group">
      <Text variant="label" className="text-site-label text-moyo-secondary">
        Moyo · n. heart
      </Text>
      <Heading
        level={1}
        size="display-xl"
        className="font-moyo-display text-site-hero md:text-site-hero"
      >
        AI tutoring that helps children learn it by heart
      </Heading>
      <View className="border-moyo-rule max-w-content-prose rounded-moyo-square border-moyo-outline bg-moyo-paper-raised p-inset-roomy shadow-moyo-2">
        <Text variant="body" className="text-site-lead">…</Text>
      </View>
    </Container>
  </Section>
</Main>
```

`md:text-site-hero` is not redundant. `Heading`'s `size` variant steps up at md
(`text-display-xl md:text-display-2xl`) and tailwind-merge only lets a class beat
another in the **same** modifier group, so overriding the base step alone would
leave the product's fixed 72px winning from 768px up — precisely where a fluid
hero should be at its most dramatic. The site-local `MoyoDisplay` in
[component-inventory.md](./component-inventory.md) closes this seam properly.

## Priority actions

| # | Action | Owner | Why |
| --- | --- | --- | --- |
| 1 | Build `MoyoDisplay` per the inventory | chapters agent | Removes the `md:text-site-hero` workaround from every chapter title. |
| 2 | Decide the marketing import surface: `@acme/ui` barrel vs `@acme/ui/primitives` | Phase 1 | ADR-001's open follow-up. 318 kB + 319 kB of client JS for one hero. Unblocked by this layer — the tokens resolve identically through either. |
| 3 | Grain implementation | texture/motion agent | `--moyo-grain-opacity` exists; the surface that consumes it does not. Keep it 2–4% and never a raster tile larger than 128px. |
| 4 | Per-screen `accessibility-review` on each chapter | chapters agent | This layer clears contrast; focus order, targets and reduced motion are screen-level. |
