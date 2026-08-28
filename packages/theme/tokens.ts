/**
 * @acme/theme — the single token source (PROMPT-2).
 * Moyo brand: highlighter yellow, hot pink, ink black on paper cream.
 *
 * The primitive scale NAMES ARE LIES kept for class compatibility: `burgundy` is
 * electric yellow, `gold` is blue. Feature code must never name a primitive scale
 * directly — use the schoolhouse semantic aliases below, which say what the colour
 * IS. This is the whole reason PR-0 exists (doc 03 §6).
 *
 * Raw styling values are banned in feature code: if a value is missing, it is
 * added here, not inlined at the call site.
 * SOT: this file · docs/pack/08-visual-hierarchy-spacing-spec.md
 * SOT-KEYWORDS: theme tokens color spacing typography palette design-system brand
 *
 * `build-css.mjs` emits theme.css (web/storybook, Tailwind v4 `@theme` with
 * light-dark()) and theme-native.css (mobile, Uniwind `@variant` theme blocks)
 * from the tokens below. TS consumers (Skia, charts,
 * programmatic color math) import these exports directly.
 * No hex values exist outside this file.
 */

// ---- primitive palettes -----------------------------------------------------

export const palette = {
  // RETRO primary — electric yellow (scale name kept for class compatibility)
  burgundy: {
    50: '#FFFCEB',
    100: '#FFF7C7',
    200: '#FFEE8A',
    300: '#FFE14D',
    400: '#FFDB33',
    500: '#F2C700',
    600: '#D1A800',
    700: '#A98700',
    800: '#806400',
    900: '#574400',
    950: '#332800',
  },
  // RETRO accent — hot pink (scale name kept for class compatibility)
  ember: {
    50: '#FFF0F7',
    100: '#FFDBEC',
    200: '#FFB8D9',
    300: '#FF8FC2',
    400: '#FF69B4',
    500: '#F7418F',
    600: '#DB2777',
    700: '#B01B5E',
    800: '#831146',
    900: '#570A2E',
    950: '#33061B',
  },
  // RETRO neutrals — paper cream to true black
  ink: {
    50: '#FFFDF7',
    100: '#F6F3E8',
    200: '#E5E1D3',
    300: '#C4C0B0',
    400: '#94917F',
    500: '#6E6B5C',
    600: '#55524A',
    700: '#3B3833',
    800: '#262420',
    900: '#171614',
    950: '#0D0C0B',
  },
  white: '#FFFFFF',
  // Event-type accents — readable on both light and dark surfaces.
  // `gold` is BLUE: the name predates Moyo and is kept only so emitted class
  // names stay stable. Reach for the `ballpoint` alias instead.
  gold: {
    50: '#EEF4FF', 100: '#DCE8FF', 200: '#B8D0FF', 300: '#8AB0FF',
    400: '#5C8AFF', 500: '#3B6DF6', 600: '#2952D9', 700: '#1F3FAD',
    800: '#172E80', 900: '#101F57', 950: '#0A1433',
  },
  forest: {
    50: '#EEF6F0', 100: '#D3E9D8', 200: '#ADD6B6', 300: '#7DB98B',
    400: '#529B65', 500: '#357A49', 600: '#28613A', 700: '#214E30',
    800: '#183D26', 900: '#102B1C', 950: '#08190F',
  },
  sky: {
    50: '#EEF4FA', 100: '#D4E6F4', 200: '#B3D4ED', 300: '#88BBE2',
    400: '#5B9DD3', 500: '#3B7EB8', 600: '#2F6597', 700: '#28527D',
    800: '#214060', 900: '#172E45', 950: '#0D1B29',
  },
  rose: {
    50: '#FDF2F2', 100: '#FBE0E0', 200: '#F6C5C5', 300: '#EB9C9C',
    400: '#D96B6B', 500: '#C04444', 600: '#A03333', 700: '#7E2929',
    800: '#5D2121', 900: '#3D1717', 950: '#230C0C',
  },
  slate: {
    50: '#F4F4F5', 100: '#E4E4E7', 200: '#D4D4D8', 300: '#A1A1AA',
    400: '#71717A', 500: '#52525B', 600: '#3F3F46', 700: '#27272A',
    800: '#18181B', 900: '#121215', 950: '#09090B',
  },
} as const;

// ---- semantic colors (light / dark) ----------------------------------------
// Emitted as `light-dark(...)` so system-following is zero-code on every platform.

export const semantic = {
  surface: { light: palette.ink[50], dark: '#161411' },
  'surface-raised': { light: palette.white, dark: '#211F1B' },
  'surface-sunken': { light: palette.ink[100], dark: '#0F0E0C' },
  text: { light: palette.ink[950], dark: palette.ink[50] },
  'text-muted': { light: palette.ink[600], dark: palette.ink[400] },
  'text-inverse': { light: palette.ink[50], dark: palette.ink[950] },
  // RETRO: flat electric yellow, black ink on top
  primary: { light: palette.burgundy[400], dark: palette.burgundy[400] },
  'primary-pressed': { light: palette.burgundy[500], dark: palette.burgundy[500] },
  'on-primary': { light: palette.ink[950], dark: palette.ink[950] },
  accent: { light: palette.ember[500], dark: palette.ember[400] },
  // Not palette.ember[600] (#DB2777): black ink on it is 4.25:1, under AA, and
  // this is a hover/press BACKGROUND that carries the button label. Nudged just
  // light enough to clear 4.5 (4.64:1) while staying visibly darker than
  // `accent`, so the pressed-is-darker convention `primary-pressed` follows
  // still holds. The scale step is left alone — nothing else consumes it.
  'accent-pressed': { light: '#E3307E', dark: palette.ember[500] },
  'on-accent': { light: palette.ink[950], dark: palette.ink[950] },
  // RETRO: borders are ink, not grey — the outline IS the design
  border: { light: palette.ink[950], dark: palette.ink[50] },
  'border-strong': { light: '#000000', dark: '#FFFDF7' },
  // Ink at 80% — the Cool dial's hairline (doc 02 §5.3). Still an AA text colour
  // against surface, so remapping --color-border inside .dial-cool is safe.
  'border-soft': { light: 'rgba(13, 12, 11, 0.80)', dark: 'rgba(255, 253, 247, 0.80)' },
  // Ink at 10% — the Cool dial's whisper of an offset shadow (doc 02 §5.3).
  // Pre-resolved rgba rather than color-mix(): React Native cannot evaluate
  // color-mix, so a shared token has to be a value both engines can read.
  // Never a text or border colour — it fails contrast by design.
  'border-faint': { light: 'rgba(13, 12, 11, 0.10)', dark: 'rgba(255, 253, 247, 0.10)' },
  focus: { light: palette.gold[500], dark: palette.gold[400] },
  danger: { light: '#D31F2B', dark: '#FF7A85' },
  'on-danger': { light: palette.white, dark: '#3D0508' },

  // ---- schoolhouse aliases (PR-0) -------------------------------------------
  // The design language is classroom stationery, so the tokens are named for the
  // instrument that makes the mark. Two different jobs live here, and mixing them
  // is the mistake this comment exists to prevent:
  //
  //   highlighter — a SURFACE. Ink goes on top of it, so it carries `on-*`.
  //   ballpoint / redpen / grade — MARKS. They are drawn on the paper, so each
  //   must clear AA against `surface` in both modes and shifts value per mode.
  //
  // `redpen` is teacher feedback, deliberately NOT `danger`: a correction is not
  // an error state, and a child seeing alarm-red for ordinary marking is a
  // child-outcome problem, not a palette one.
  highlighter: { light: palette.burgundy[300], dark: palette.burgundy[300] },
  'on-highlighter': { light: palette.ink[950], dark: palette.ink[950] },
  // Highlighter at 24% — the selected DataTable row (doc 08 §4.6) and the
  // selected InkTile. Pre-resolved rather than `bg-highlighter/24`, for the same
  // reason as `border-faint`: the opacity modifier compiles to color-mix(), which
  // React Native cannot evaluate. A fill only — ink on it still clears AA, but it
  // is never a text or border colour.
  'highlighter-underlay': {
    light: 'rgba(255, 225, 77, 0.24)',
    dark: 'rgba(255, 225, 77, 0.24)',
  },
  ballpoint: { light: palette.gold[600], dark: palette.gold[400] },
  redpen: { light: palette.rose[600], dark: palette.rose[300] },
  grade: { light: palette.forest[600], dark: palette.forest[300] },

  // ---- role accents (doc 36 §5 · PR-141) ------------------------------------
  // One product, five doors: everything is invariant per role except this ONE
  // themed pair — `role-accent` + its 24% underlay. build-css.mjs emits a
  // `.role-<name>` scope per role (same mechanism as the dial) that re-points
  // the generic pair, so a slot component writes `bg-role-accent-underlay`
  // once and every shell colours it.
  //
  // Minted at the highlighter's OKLCH lightness so ink-on-accent lands in the
  // same ~14:1 class in every shell — but WCAG luminance is not OKLab L, so
  // doc 36's working L 0.88 measured LOW on three hues (guardian 13.69, tutor
  // 13.03, org 12.27 vs the learner bar of 14.36). Lightness was raised
  // minimally per hue until each accent meets ink at >= that bar; the OKLCH
  // source of each hex is recorded on its line and check-contrast.mjs gates
  // the parity at 14:1, so a hue tweak cannot quietly leave the class.
  //
  // Accents carry hue, never meaning: redpen/grade keep their jobs in every
  // shell, and tooling/check-role-accent.mjs keeps these out of body text,
  // borders, and the primary button (underlay/ring/band slots only). Admin
  // mints NOTHING on purpose — the back office earns no colour, so there is
  // deliberately no `role-admin` token. Values match in both modes, like
  // `highlighter`: the accent is the door's identity and must not shift under
  // the theme. Underlays are pre-resolved rgba for the same reason as
  // `highlighter-underlay`: React Native cannot evaluate color-mix().
  'role-accent': { light: palette.burgundy[400], dark: palette.burgundy[400] },
  'role-accent-underlay': { light: 'rgba(255, 219, 51, 0.24)', dark: 'rgba(255, 219, 51, 0.24)' },
  'on-role-accent': { light: palette.ink[950], dark: palette.ink[950] },
  // learner: the brand yellow, hue 95° — referenced from the existing scale,
  // never re-minted. 14.36:1 under ink; this ratio IS the parity bar.
  'role-learner': { light: palette.burgundy[400], dark: palette.burgundy[400] },
  'role-learner-underlay': { light: 'rgba(255, 219, 51, 0.24)', dark: 'rgba(255, 219, 51, 0.24)' },
  // oklch(0.90 0.10 230) sky — doc L .88 read 13.69:1; .90 gives 14.52:1.
  'role-guardian': { light: '#95EBFF', dark: '#95EBFF' },
  'role-guardian-underlay': { light: 'rgba(149, 235, 255, 0.24)', dark: 'rgba(149, 235, 255, 0.24)' },
  // oklch(0.915 0.10 300) violet — doc L .88 read 13.03:1; .915 gives 14.39:1.
  'role-tutor': { light: '#EDD4FF', dark: '#EDD4FF' },
  'role-tutor-underlay': { light: 'rgba(237, 212, 255, 0.24)', dark: 'rgba(237, 212, 255, 0.24)' },
  // oklch(0.95 0.12 50) tangerine — the furthest move: warm hues carry the
  // least WCAG luminance at fixed OKLab L, so .88 read 12.27:1; .95 gives 14.44:1.
  'role-org': { light: '#FFD7A5', dark: '#FFD7A5' },
  'role-org-underlay': { light: 'rgba(255, 215, 165, 0.24)', dark: 'rgba(255, 215, 165, 0.24)' },
  // oklch(0.89 0.10 200) teal — doc L .88 read 14.13:1; .89 gives 14.55:1.
  'role-district': { light: '#83EFF5', dark: '#83EFF5' },
  'role-district-underlay': { light: 'rgba(131, 239, 245, 0.24)', dark: 'rgba(131, 239, 245, 0.24)' },
} as const;

/**
 * The five doors, in shell order (doc 36 §5). Drives the `.role-*` scopes
 * build-css.mjs emits, the RoleScope kit component, and the contrast pairs —
 * one list, so a sixth role cannot be added in one place and missed in another.
 * Admin is absent on purpose: graphite ramp, no accent.
 */
export const accentRoles = ['learner', 'guardian', 'tutor', 'org', 'district'] as const;
export type AccentRole = (typeof accentRoles)[number];

// ---- typography -------------------------------------------------------------

export const fontFamilies = {
  // RETRO: Archivo Black shouts the headlines; Space Grotesk does the work.
  display: "'Archivo Black', 'Arial Black', sans-serif",
  sans: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  // Chivo Mono is Omnibus-Type, same foundry as Archivo Black — it reads as
  // family with the display face rather than a fourth voice. Variable 100–900,
  // which matters because hierarchy here is carried by weight (doc 08 §3.2).
  // Two jobs: tabular data, and the `moyo · n. heart` dictionary device (doc 02,
  // Addendum B) — which is why the italic cut ships too.
  // Its `tnum`/`zero` features are OFF until asked for; build-css.mjs turns them
  // on for the whole family, because unslashed 0 sits a hair from O.
  mono: "'Chivo Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Display scale for hero/masthead moments; body text uses the Tailwind defaults. */
export const typeScale = {
  'display-2xl': { size: '4.5rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-xl': { size: '3.75rem', lineHeight: '1.05', tracking: '-0.02em' },
  'display-lg': { size: '3rem', lineHeight: '1.1', tracking: '-0.01em' },
  'display-md': { size: '2.25rem', lineHeight: '1.15', tracking: '-0.01em' },
  'display-sm': { size: '1.875rem', lineHeight: '1.2', tracking: '0' },
} as const;

// ---- layout -----------------------------------------------------------------

/** §8.2 content-width scale — width scales by adding columns, not stretching. */
export const contentWidths = {
  'content-form': '28rem',
  'content-feed': '38rem',
  'content-prose': '65ch',
  'content-detail': '48rem',
  'content-screen': '56rem',  // Tailwind 4xl — the default screen cap
  'content-wide': '72rem',
  'screen-2xl': '96rem',  // outer cap for every screen (user rule)

  // Adaptive split-view panes. Leading panes are fixed-width and the detail
  // pane flexes, so these are the only widths the split layout ever names —
  // emitted as --container-*, which Tailwind maps to w-*/min-w-*/max-w-*.
  'pane-primary': '20rem',
  'pane-primary-narrow': '16rem',
  'pane-supplementary': '21rem',
  'pane-inspector': '20rem',
  'pane-tutor': '23.75rem',  // doc 23 §5: 380px TutorStage primary pane
} as const;

/**
 * Doc 02 §2.1 window width classes — lower bound of each class, inclusive, in
 * dp. The Material 3 Adaptive bands under the doc's own names (`large`, not
 * androidx's `extraLarge`). TS-only export (not emitted to CSS): consumers are
 * layout policy modules that compare numbers, starting with
 * `packages/ui/adaptive-panes/constants.ts`.
 *
 * TWO WIDTH SYSTEMS COEXIST, deliberately — see
 * `packages/ui/size-class.constants.ts` for the other one: a binary
 * `compact|regular` split at 768 that TutorStage and DashboardShell hold the
 * line on. These four-band classes drive multi-pane layouts; the 768 split
 * drives one-column/two-column decisions. Do not merge them by nudging numbers.
 */
export const widthClassMinDp = {
  compact: 0,
  medium: 600,
  expanded: 840,
  large: 1200,
} as const;

export type WidthClassName = keyof typeof widthClassMinDp;

export const radius = {
  // Every interactive control shares one radius. A button at `md` (6px) beside
  // an input at `card` (10px) reads as two components from two systems sitting
  // in the same row — which is exactly what the composer looked like.
  // `tooling/check-controls.mjs` enforces this; it is a rule with a gate.
  control: '0.375rem',
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  card: '0.625rem',
  sheet: '0.875rem',
  full: '9999px',
} as const;

// RETRO elevation: hard offset slabs in the border color — no blur, ever.
export const shadows = {
  card: '4px 4px 0 0 var(--color-border-strong)',
  raised: '6px 6px 0 0 var(--color-border-strong)',
  overlay: '9px 9px 0 0 var(--color-border-strong)',
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 30,
  nav: 50,
  overlay: 70,
  modal: 80,
  toast: 90,
} as const;

// ---- motion -----------------------------------------------------------------

export const motion = {
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

// ---- UI type ramp (doc 08 §3.1) ---------------------------------------------

/**
 * The UI ramp the display scale never covered — Button and friends were falling
 * back to Tailwind's raw text-sm/base/lg. Values per dial; the dial scope remaps
 * the generic name, so a component writes `text-title` and gets the right one.
 *
 * `data` is the mono ramp: every time, price, %, and count, so columns align.
 * Doc 08 §3.1 names Spline Sans Mono here — superseded by Chivo Mono, chosen and
 * shipped in PR-0; the ramp is what the doc is specifying, not the face.
 *
 * caption is the floor: never below 12, and never for anything a user must act on.
 */
export const uiRamp = {
  'title-lg': { cool: ['1.25rem', '1.25', '600'], hot: ['1.5rem', '1.25', '700'] },
  title: { cool: ['1.0625rem', '1.3', '600'], hot: ['1.25rem', '1.3', '700'] },
  'body-lg': { cool: ['1rem', '1.5', '400'], hot: ['1.125rem', '1.55', '400'] },
  body: { cool: ['0.9375rem', '1.45', '400'], hot: ['1.0625rem', '1.5', '400'] },
  label: { cool: ['0.8125rem', '1.35', '500'], hot: ['0.9375rem', '1.4', '600'] },
  caption: { cool: ['0.75rem', '1.35', '400'], hot: ['0.8125rem', '1.4', '400'] },
  data: { cool: ['0.8125rem', '1.35', '500'], hot: ['0.9375rem', '1.4', '500'] },
  'data-lg': { cool: ['1rem', '1.3', '600'], hot: ['1.25rem', '1.3', '600'] },
} as const;

// ---- spacing tiers (doc 08 §2.1) --------------------------------------------

/**
 * Named tiers so spacing is a decision, not a habit. Values per dial.
 * §2.3's grouping law lives here: `gap-group` is the hierarchy workhorse —
 * separation between groups is what carries structure, not borders.
 */
export const spacingTiers = {
  // A single-line field is not a box of prose. `inset-tight` (16px hot) on a
  // 25.5px line pushed the composer to 64px, which read as an oversized slab
  // next to a one-line placeholder. This tier exists so the field's height is
  // governed by the age-band target token instead of by its padding.
  'inset-field': { cool: '0.5625rem', hot: '0.5625rem' },
  'inset-tight': { cool: '0.75rem', hot: '1rem' },
  inset: { cool: '1rem', hot: '1.25rem' },
  'inset-roomy': { cool: '1.25rem', hot: '1.5rem' },
  // Doc 08 names these tiers `gap-element`, `gap-stack`, `gap-group`,
  // `gap-section` — and those ARE the class names, which is why the `gap-`
  // prefix must NOT be part of the token. Tailwind builds a utility as
  // <property>-<token suffix>, so `--spacing-gap-stack` yields `gap-gap-stack`
  // and every `gap-stack` in the codebase silently does nothing. Named for the
  // role; the property supplies the prefix.
  element: { cool: '0.5rem', hot: '0.75rem' },
  stack: { cool: '0.75rem', hot: '1rem' },
  group: { cool: '1.5rem', hot: '2rem' },
  section: { cool: '2rem', hot: '3rem' },
} as const;

// ---- touch targets (doc 08 §2.4) --------------------------------------------

/**
 * Target size is a function of the signed-in child, not a hardcode: the age band
 * comes from the learner profile, so a K–2 primary action is 72 (~2cm, the NN/g
 * 4× finding) while the same component on an ops screen is 44.
 * `floor` is the absolute CI minimum (WCAG 2.2 AA) — never a design target.
 */
export const targets = {
  floor: '1.5rem',   // 24
  adult: '2.75rem',  // 44 (48 preferred on Android)
  teen: '3rem',      // 48 — Hot, grades 6–12
  child: '3.5rem',   // 56 — Hot, grades 3–5
  young: '4.5rem',   // 72 — Hot, K–2 primary actions
} as const;

// ---- reading comfort (doc 08 §3.3) ------------------------------------------

/**
 * "Comfy reading" — a per-learner toggle, never framed as a diagnosis
 * (the plan's no-labeling rule). Default OFF: the same literature that supports
 * wider spacing for some readers shows it slows fast readers.
 */
export const readingComfort = {
  'letter-spacing': '0.06em',
  'line-height': '1.7',
} as const;

// ---- the dial ---------------------------------------------------------------

/**
 * One DNA, two temperatures (doc 02 §5.3 + doc 08 §2.5 density row).
 * Hot = learner/family surfaces; Cool = ops/educator/institution.
 *
 * The dial is NOT a theme. Light/dark is one global preference, but a single
 * parent screen is "cool structure, hot accents on child-related cards" — both
 * temperatures render in one tree — so it travels as a component prop
 * (doc 02 §7 already types `InkTile` with `dial: hot·cool`), not as an
 * app-level variant. That is why these emit as dial-suffixed utilities rather
 * than as a second @variant axis: React Native has no cascade to inherit from.
 *
 * Colour is deliberately absent. The dial governs which fills get USED
 * (Hot saturated, Cool paper/white with colour reserved for status), not what
 * the values are — so both temperatures share one palette and one contrast pass.
 */
export const dial = {
  hot: {
    radius: '0.875rem',    // 14px — chunky-friendly
    shadow: '4px 4px 0 0 var(--color-border-strong)',
    'row-height': '4rem',  // 64+, roomy enough for an age-band target
    duration: '200ms',     // tactile physics; the playful end of the ramp
  },
  cool: {
    radius: '0.5rem',      // 8px
    shadow: '2px 2px 0 0 var(--color-border-faint)',
    'row-height': '2.75rem', // 44 — the adult target floor
    duration: '140ms',     // 120–160ms utility transitions
  },
  // Insets live in `spacingTiers`, NOT here. They were in both briefly and each
  // emitted --spacing-inset-<temp>: identical values, so nothing broke, but two
  // sources for one variable means the next edit to one of them silently loses
  // to whichever the emitter writes last.
} as const;

export const breakpoints = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type ContentWidth = keyof typeof contentWidths;
