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

/**
 * The four Moyo brand hues, as full ramps.
 *
 * They were four flat identity values plus four unrelated pastels. The pastels
 * ARE these hues — `moyo-lavender` is plum 100, `moyo-mint` is lagoon 100 — and
 * writing them as steps of one ramp is what lets a scheme be derived instead of
 * invented: a dark header is plum 700 (the logo's own M), its ink is plum 100,
 * and both are provably the same hue as the mark rather than a hex that looked
 * close. Every other family in this file is already a ramp; these are now too.
 *
 * The named steps are FIXED POINTS from the brand art and must not move:
 *   plum 100/700     moyo-lavender / moyo-purple (logo M, #3C2357 in the source)
 *   lagoon 100/500   moyo-mint / moyo-teal (#0A9FA6)
 *   flame 100/400    moyo-guava / moyo-coral (#E55545 · #ED6646)
 *   sun 100/400      moyo-mango-pastel / moyo-mango (#F4A629)
 */
const brandScales = {
  plum: {
    50: '#F6F1FB', 100: '#E9DDF5', 200: '#D5C1EC', 300: '#B99BDE',
    400: '#9B77CC', 500: '#7C55B0', 600: '#5D3A8B', 700: '#43216B',
    800: '#32184F', 900: '#221034', 950: '#14091F',
  },
  lagoon: {
    50: '#EFFAF9', 100: '#CFEDEA', 200: '#A5DEDA', 300: '#6FCAC5',
    400: '#34B2AD', 500: '#12A7A3', 600: '#0E8785', 700: '#0C6A68',
    800: '#0A5150', 900: '#073836', 950: '#042322',
  },
  flame: {
    50: '#FEF3F1', 100: '#FADBD5', 200: '#F7BDB2', 300: '#F58E7B',
    400: '#F0543F', 500: '#D8412F', 600: '#B33325', 700: '#8D281D',
    800: '#661D15', 900: '#42130E', 950: '#280B08',
  },
  sun: {
    50: '#FFF9EC', 100: '#FFE8A8', 200: '#FFD777', 300: '#FFC547',
    400: '#FFB21D', 500: '#E09310', 600: '#B6760B', 700: '#8D5B08',
    800: '#654005', 900: '#402803', 950: '#261802',
  },
} as const;

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
  ...brandScales,
  /*
    The brand identities, as ALIASES of the scales above — the logo's own inks
    (packages/ui/logo-fill.ts maps #3C2357 -> moyo-purple, #0A9FA6 -> moyo-teal,
    #E55545 -> moyo-coral, #F4A629 -> moyo-mango) and the four pastels that used
    to be unrelated one-off values.

    Aliases, not literals, because the dark scheme has to be BUILT from these
    hues and a flat value has no darker step to build from. The first dark pass
    invented `#D8B33C`, `#F76BB0`, `#C9C3B1` and warm-brown grounds — none of
    them in the palette, none of them related to the mark, and the result could
    not sit next to the logo. A scheme is only a scheme if every value in it
    comes off a brand ramp.
  */
  'moyo-purple': brandScales.plum[700],
  'moyo-coral': brandScales.flame[400],
  'moyo-teal': brandScales.lagoon[500],
  'moyo-mango': brandScales.sun[400],
  'moyo-lavender': brandScales.plum[100],
  'moyo-guava': brandScales.flame[100],
  'moyo-mint': brandScales.lagoon[100],
  'moyo-mango-pastel': brandScales.sun[100],
} as const;

// ---- semantic colors (light / dark) ----------------------------------------
// Emitted as `light-dark(...)` so system-following is zero-code on every platform.

/*
  DARK IS THE BRAND AT NIGHT, not a second palette.

  Every dark value below is a STEP OF A RAMP that already carries the identity —
  `plum` for ground and chrome, `ink` for paper and its line, `burgundy` for the
  marker, `ember` for the accent. Nothing here is a hex chosen because it looked
  right next to something else. Two rules produced the whole scheme:

    1. Same hue, different step. A colour never changes family between schemes,
       so a card, a marker and a header are recognisably the same object at
       night. `primary` steps 400 -> 600 rather than becoming a gold.
    2. The ground is plum, not black and not brown. The mark sits on this ground
       on every screen; a neutral ground made the logo look pasted on, and a
       near-black one turned every 2px border into a lit grid.

  The RATIOS are what tooling/check-contrast.mjs protects. The RAMPS are what
  keeps the result looking like Moyo — and both have to hold, because a scheme
  that only passes contrast is how the first dark build shipped.
*/
export const semantic = {
  /*
    The dark ground is the BRAND's own deep plum (plum 900/950), not a neutral
    and not the warm brown an earlier pass invented. Two reasons it has to be a
    brand hue: the mark sits on this ground on every screen, and a near-black
    ground turned every 2px border into a lit grid. Steps are one ramp apart so
    elevation is legible without a shadow, which the flat design language bans.
  */
  surface: { light: palette.ink[50], dark: palette.plum[900] },
  'surface-raised': { light: palette.white, dark: palette.plum[800] },
  'surface-sunken': { light: palette.ink[100], dark: palette.plum[950] },
  // ink[50] (#FFFDF7) as dark body text is brighter than the paper it imitates;
  // ink[100] is the same cream one step down and reads as chalk, not headlight.
  // The neutral family stays `ink` in both schemes: paper and its ink are the
  // product's other identity, and inverting them is what dark mode IS here.
  text: { light: palette.ink[950], dark: palette.ink[100] },
  'text-muted': { light: palette.ink[600], dark: palette.ink[400] },
  'text-inverse': { light: palette.ink[50], dark: palette.ink[950] },
  /*
    RETRO: flat electric yellow, black ink on top. The dark cut steps DOWN the
    same ramp (400 -> 600) rather than moving to a new colour: a full-bleed
    `bg-primary` card is the loudest object on a learner screen and at the light
    cut's value it out-glows everything on a dark ground. Same hue, less light.
  */
  primary: { light: palette.burgundy[400], dark: palette.burgundy[600] },
  'primary-pressed': { light: palette.burgundy[500], dark: palette.burgundy[700] },
  'on-primary': { light: palette.ink[950], dark: palette.ink[950] },
  accent: { light: palette.ember[500], dark: palette.ember[400] },
  // Not palette.ember[600] (#DB2777): black ink on it is 4.25:1, under AA, and
  // this is a hover/press BACKGROUND that carries the button label. Nudged just
  // light enough to clear 4.5 (4.64:1) while staying visibly darker than
  // `accent`, so the pressed-is-darker convention `primary-pressed` follows
  // still holds. The scale step is left alone — nothing else consumes it.
  'accent-pressed': { light: '#E3307E', dark: palette.ember[500] },
  'on-accent': { light: palette.ink[950], dark: palette.ink[950] },
  // RETRO: borders are ink, not grey — the outline IS the design.
  // In the dark the ink becomes CHALK, not white: at 2px, a #FFFDF7 frame around
  // every card is a grid of light on a dark ground and the cards read as cages.
  // ink[300] keeps the drawn-line character at 9.7:1 — far above the 3:1 the
  // structural bar asks for — while letting the content inside be the bright thing.
  border: { light: palette.ink[950], dark: palette.ink[300] },
  'border-strong': { light: '#000000', dark: palette.ink[100] },
  // Ink at 80% — the Cool dial's hairline (doc 02 §5.3). Still an AA text colour
  // against surface, so remapping --color-border inside .dial-cool is safe.
  'border-soft': { light: 'rgba(13, 12, 11, 0.80)', dark: 'rgba(196, 192, 176, 0.80)' },
  // Ink at 10% — the Cool dial's whisper of an offset shadow (doc 02 §5.3).
  // Pre-resolved rgba rather than color-mix(): React Native cannot evaluate
  // color-mix, so a shared token has to be a value both engines can read.
  // Never a text or border colour — it fails contrast by design.
  'border-faint': { light: 'rgba(13, 12, 11, 0.10)', dark: 'rgba(246, 243, 232, 0.10)' },
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
  // Dimmed in the dark for the same reason as `primary`: a marker laid over a
  // lamp-lit page is warm gold, not a lit lemon. Hue holds so a highlighted row
  // is recognisably the same gesture in both schemes.
  highlighter: { light: palette.burgundy[300], dark: palette.burgundy[500] },
  'on-highlighter': { light: palette.ink[950], dark: palette.ink[950] },
  // Highlighter at 24% — the selected DataTable row (doc 08 §4.6) and the
  // selected InkTile. Pre-resolved rather than `bg-highlighter/24`, for the same
  // reason as `border-faint`: the opacity modifier compiles to color-mix(), which
  // React Native cannot evaluate. A fill only — ink on it still clears AA, but it
  // is never a text or border colour.
  'highlighter-underlay': {
    light: 'rgba(255, 225, 77, 0.24)',
    dark: 'rgba(242, 199, 0, 0.24)',
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
  // oklch(0.955 0.11 30) coral — sits between tangerine and rose, distinct for
  // the classroom-teacher shell without drifting into danger red. The warm-hue
  // penalty again: the original L .93 mint (#FFC7B2) measured 13.09:1 under ink,
  // below the parity bar, and shipped unchecked because the old declared pair
  // list stopped at five roles. Raised like the other hues: .955 gives 14.45:1.
  'role-teacher': { light: '#FFD5C4', dark: '#FFD5C4' },
  'role-teacher-underlay': { light: 'rgba(255, 213, 196, 0.24)', dark: 'rgba(255, 213, 196, 0.24)' },
  // oklch(0.92 0.10 150) mint — the campus-operating shell, different from tutor
  // violet and district teal but still light enough for ink at >= 14:1.
  'role-school': { light: '#BFF5C8', dark: '#BFF5C8' },
  'role-school-underlay': { light: 'rgba(191, 245, 200, 0.24)', dark: 'rgba(191, 245, 200, 0.24)' },
  // oklch(0.89 0.10 200) teal — doc L .88 read 14.13:1; .89 gives 14.55:1.
  'role-district': { light: '#83EFF5', dark: '#83EFF5' },
  'role-district-underlay': { light: 'rgba(131, 239, 245, 0.24)', dark: 'rgba(131, 239, 245, 0.24)' },

  // ---- chrome tints: the brand pastels, per scheme -----------------------------
  /*
    The four Moyo pastels are LIGHT-SCHEME values. A shell that paints chrome
    straight from `palette['moyo-*']` therefore paints a light bar in dark mode —
    which is exactly how the app shipped a lavender header with dark-mode body
    text on it, illegible on a night-mode phone. The pastel is not the token; the
    PAIR is. Each hue gets a scheme-aware surface and the ink that rides it:

      light  pastel ground, plum ink        (the printed page)
      dark   deep ground of the SAME hue, the pastel itself as the ink

    The inversion is what keeps a door recognisable at night — a guardian's guava
    header is still warm, a learner's lavender still cool — where a neutral dark
    bar would make all seven doors identical. Dark grounds sit 1.4–1.9:1 above
    `surface` so chrome reads as chrome; the 2px border does the rest, which is
    what WCAG 1.4.11 actually asks for. Foregrounds clear 7:1 in both schemes.

    `chromeTint` below is the ONE map from a pastel primitive to its pair — role
    scopes go through it, so a door cannot pick a hue and miss its dark half.
  */
  'chrome-lavender': { light: palette.plum[100], dark: palette.plum[700] },
  'on-chrome-lavender': { light: palette.plum[700], dark: palette.plum[100] },
  'chrome-guava': { light: palette.flame[100], dark: palette.flame[800] },
  'on-chrome-guava': { light: palette.plum[700], dark: palette.flame[100] },
  'chrome-mint': { light: palette.lagoon[100], dark: palette.lagoon[800] },
  'on-chrome-mint': { light: palette.plum[700], dark: palette.lagoon[100] },
  'chrome-mango': { light: palette.sun[100], dark: palette.sun[800] },
  'on-chrome-mango': { light: palette.plum[700], dark: palette.sun[100] },

  // ---- Moyo shell surface slots -----------------------------------------------
  // The semantic slots shells consume. Defaults are the LEARNER door; the
  // `.role-*` scopes re-point each slot AND its carried foreground together, so a
  // door can never inherit the previous door's ink on its own surface.
  'surface-header': { light: palette.plum[100], dark: palette.plum[700] },
  'on-surface-header': { light: palette.plum[700], dark: palette.plum[100] },
  // ONE chrome family, top and bottom. M3 puts the navigation bar and the top
  // app bar on the same `surface-container` and reserves colour for the active
  // indicator; the shell used to paint a lavender header against a mint tab bar
  // and rail, which read as three unrelated products in one window. The DOOR is
  // carried by which pastel that one family is, and selection is carried by the
  // marker — never by giving the bottom bar its own hue.
  'surface-footer': { light: palette.plum[100], dark: palette.plum[700] },
  'on-surface-footer': { light: palette.plum[700], dark: palette.plum[100] },
  'surface-muted': { light: palette.flame[100], dark: palette.flame[800] },
  'on-surface-muted': { light: palette.plum[700], dark: palette.flame[100] },
  // Content-meaning tints. Same values as the chrome pair of the same hue; text
  // placed on one takes that hue's `on-chrome-*` as its foreground.
  'surface-ai': { light: palette.plum[100], dark: palette.plum[700] },
  'surface-family': { light: palette.flame[100], dark: palette.flame[800] },
  'surface-learning': { light: palette.lagoon[100], dark: palette.lagoon[800] },
  'surface-achievement': { light: palette.sun[100], dark: palette.sun[800] },
  /*
    The signature-action fill (the raised camera slot). Deep plum on the light
    pastels; on the dark chrome a deep plum would sit ON a deep ground and vanish
    into it, so the dark cut lifts to the same hue's tint and flips its ink. The
    foreground is `on-action-primary` — named for the fill it rides, which is what
    puts it inside check-contrast's derived pairs instead of outside every gate.
  */
  'action-primary': { light: palette.plum[700], dark: palette.plum[300] },
  'on-action-primary': { light: palette.plum[50], dark: palette.plum[900] },
  // The coral hairline strip. Identity, not a scheme value, so it holds — but its
  // ink is INK, never white: white on coral is 3.47:1 and has never passed AA.
  'surface-accent': { light: palette.flame[400], dark: palette.flame[400] },
  'on-surface-accent': { light: palette.ink[950], dark: palette.ink[950] },

  // ---- tenant shell tokens ----------------------------------------------------
  // Defaults mirror Moyo brand values. The web `TenantScope` overrides these per
  // active tenant; declaring them in @theme makes `bg-tenant-*` utilities real.
  //
  // Their DARK cuts mirror the product scheme step for step (`tenant-surface` is
  // `surface`, `tenant-header` is `surface-header`, …). They used to hold the
  // pre-brand near-blacks and a light-only lavender header, so an admin shell in
  // dark mode drifted away from the app it administers — and a tenant that never
  // overrides anything is the common case, which is exactly when the default has
  // to already be right.
  'tenant-primary': { light: palette['moyo-purple'], dark: palette['moyo-purple'] },
  'tenant-primary-hover': { light: palette['moyo-purple'], dark: palette['moyo-purple'] },
  'tenant-primary-foreground': { light: palette.white, dark: palette.white },
  'tenant-header': { light: palette.plum[100], dark: palette.plum[700] },
  'tenant-header-foreground': { light: palette.plum[700], dark: palette.plum[100] },
  'tenant-header-muted': { light: `${palette.plum[700]}B3`, dark: `${palette.plum[100]}B3` },
  'tenant-header-border': { light: `${palette.plum[700]}26`, dark: `${palette.plum[100]}26` },
  'tenant-sidebar': { light: palette.ink[50], dark: palette.plum[800] },
  'tenant-sidebar-foreground': { light: palette.ink[950], dark: palette.ink[100] },
  'tenant-sidebar-muted': { light: palette.ink[600], dark: palette.ink[300] },
  'tenant-sidebar-active': { light: palette['moyo-coral'], dark: palette['moyo-coral'] },
  'tenant-sidebar-active-foreground': { light: palette.ink[950], dark: palette.ink[950] },
  'tenant-sidebar-active-indicator': { light: palette['moyo-coral'], dark: palette['moyo-coral'] },
  'tenant-accent': { light: palette['moyo-coral'], dark: palette['moyo-coral'] },
  'tenant-accent-hover': { light: palette['moyo-coral'], dark: palette['moyo-coral'] },
  'tenant-accent-foreground': { light: palette.ink[950], dark: palette.ink[950] },
  'tenant-surface': { light: palette.ink[50], dark: palette.plum[900] },
  'tenant-surface-subtle': { light: palette.ink[100], dark: palette.plum[950] },
  'tenant-border': { light: palette.ink[950], dark: palette.ink[300] },
  'tenant-focus-ring': { light: palette['moyo-coral'], dark: palette['moyo-coral'] },
  'tenant-success': { light: palette.forest[600], dark: palette.forest[300] },
  'tenant-warning': { light: palette.rose[500], dark: palette['moyo-mango'] },
  'tenant-danger': { light: palette.rose[600], dark: palette.rose[300] },
} as const;

/**
 * The seven doors, in shell order (doc 36 §5). Drives the `.role-*` scopes
 * build-css.mjs emits, the RoleScope kit component, and the contrast pairs —
 * one list, so an eighth role cannot be added in one place and missed in another.
 * Admin is absent on purpose: graphite ramp, no accent.
 */
export const accentRoles = ['learner', 'guardian', 'tutor', 'teacher', 'org', 'school', 'district'] as const;
export type AccentRole = (typeof accentRoles)[number];

/**
 * Palette families a schedule resource column may claim (EventBlock,
 * ScheduleGrid). Declared HERE rather than in the feature so the list is a
 * token-system fact: tooling/check-contrast.mjs derives a WCAG gate for every
 * family on this list, and the schedule's ACCENT_CLASSES record is keyed on
 * this type — so an accent added here cannot ship without classes, and cannot
 * ship classes without a contrast check.
 */
export const resourceAccents = ['ember', 'gold', 'forest', 'sky', 'rose'] as const satisfies readonly (keyof typeof palette)[];
export type ResourceAccentName = (typeof resourceAccents)[number];

/**
 * Brand pastel -> the scheme-aware chrome pair that carries it. The ONE crossing
 * from a primitive hue name to a themed token, so a surface can never be painted
 * from the raw pastel (which only exists in the light scheme) and a foreground
 * can never be chosen independently of the surface it sits on.
 */
export const chromeTint = {
  'moyo-lavender': 'chrome-lavender',
  'moyo-guava': 'chrome-guava',
  'moyo-mint': 'chrome-mint',
  'moyo-mango-pastel': 'chrome-mango',
} as const satisfies Record<string, keyof typeof semantic>;
export type ChromePastel = keyof typeof chromeTint;

/**
 * Per-role Moyo shell surfaces: WHICH PASTEL each door claims, and nothing else.
 * build-css.mjs resolves each hue through `chromeTint` and emits both the surface
 * and its carried ink into the `.role-*` scope, so a component writes
 * `bg-surface-header text-on-surface-header` once and the wrapper picks the door.
 *
 * `actionPrimary`, `surfaceAccent` and the two `textOn*` slots used to live here
 * with the same value in all seven doors. They are gone on purpose: a slot every
 * door agrees on is not a per-door decision, and re-pointing it at a raw
 * primitive is precisely what pinned the chrome to the light scheme. Those slots
 * now inherit their scheme-aware defaults from `semantic` above.
 *
 * Tenant brand overrides live one layer above, at the theme-provider boundary —
 * `packages/app/core/tenant-brand.ts` reads `surfaceHeader` as a pastel NAME,
 * which is why the values here stay primitive names rather than token names.
 */
export const roleTheme = {
  learner: {
    surfaceHeader: 'moyo-lavender',
    surfaceFooter: 'moyo-lavender',
    surfaceMuted: 'moyo-guava',
  },
  guardian: {
    surfaceHeader: 'moyo-guava',
    surfaceFooter: 'moyo-guava',
    surfaceMuted: 'moyo-lavender',
  },
  tutor: {
    surfaceHeader: 'moyo-mango-pastel',
    surfaceFooter: 'moyo-mango-pastel',
    surfaceMuted: 'moyo-guava',
  },
  teacher: {
    surfaceHeader: 'moyo-mint',
    surfaceFooter: 'moyo-mint',
    surfaceMuted: 'moyo-guava',
  },
  org: {
    surfaceHeader: 'moyo-mint',
    surfaceFooter: 'moyo-mint',
    surfaceMuted: 'moyo-guava',
  },
  school: {
    surfaceHeader: 'moyo-mint',
    surfaceFooter: 'moyo-mint',
    surfaceMuted: 'moyo-guava',
  },
  district: {
    surfaceHeader: 'moyo-lavender',
    surfaceFooter: 'moyo-lavender',
    surfaceMuted: 'moyo-guava',
  },
} as const satisfies Record<AccentRole, Record<string, ChromePastel>>;
export type RoleTheme = (typeof roleTheme)[AccentRole];

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

/**
 * The same three faces, named the way NATIVE resolves them.
 *
 * expo-font registers each embedded ttf under its FILE basename, and React
 * Native has no font-family fallback list — the first name is the only one
 * tried, and an unmatched name silently drops to the system face. So the CSS
 * names above never resolved on device: the app shipped in Roboto/SF while the
 * site rendered the brand faces, and nothing failed loudly enough to notice.
 *
 * The files' own internal family names are no help either — SpaceGrotesk-
 * Variable.ttf calls itself "Space Grotesk Light" and ChivoMono-Variable.ttf
 * "Chivo Mono Medium" — which is why these are the basenames, not the families.
 * Keep this map in step with the `expo-font` plugin list in app.config.ts.
 * SOT: apps/mobile/app.config.ts · packages/assets/fonts
 */
export const nativeFontFamilies = {
  display: "'ArchivoBlack-Regular'",
  sans: "'SpaceGrotesk-Variable'",
  mono: "'ChivoMono-Variable'",
} as const satisfies Record<keyof typeof fontFamilies, string>;

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
  /*
    The 45–75-character measure doc 08 §1 calls law, expressed in rem instead of
    the `65ch` it used to be. `ch` is not a unit the native styling pipeline can
    resolve, and neither library FAILS on it — they degrade differently and both
    degrade wrong. react-native-css drops the declaration (`ch` falls into the
    unsupported-unit arm of compiler/declarations.js and returns undefined), so
    the cap silently does not exist; Uniwind's Units.processLength has a
    `default:` arm that warns and then returns `length.value` UNCHANGED, so on
    mobile `max-w-content-prose` compiled to `maxWidth: 65` — sixty-five DP.
    Every prose surface on the phone was capped at the width of four letters,
    which is why the K–2 hub's greeting bubble rendered one character per line.

    36rem ≈ 65 characters of Schibsted Grotesk at the 16px base (≈0.55em per
    glyph), so web is unchanged to within a few pixels and native gets a cap
    that exists. The measure is the law; `ch` was only ever the notation.
  */
  'content-prose': '36rem',
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
 *
 * PX, NOT REM, and this is the one scale where that is not a style preference.
 * A target requirement is an ABSOLUTE physical size — WCAG 2.2 SC 2.5.8 says 24
 * CSS px, Apple says 44pt, Material says 48dp — so a target expressed relative
 * to a root font size is the wrong shape of number, and it bit us: the mobile
 * bundler sets `polyfills.rem = 14` (apps/mobile/metro.config.js, kept from the
 * NativeWind migration so spacing would not shift), and every rem token is
 * therefore multiplied by 14 on device instead of 16. The bands were shipping
 * at 21 / 38.5 / 42 / 49 / 63 — the ADULT band landed 5.5 under Apple's 44 and
 * 9.5 under Material's 48, and the K–2 "2cm" band was 63, not 72. It was
 * invisible because `tooling/check-targets.mjs` computes rem at 16, so CI
 * asserted the sizes the DESIGN intends rather than the ones the device gets.
 *
 * In px, both platforms land on the same number and the rem base cannot move
 * it. Web is unchanged: it already resolved these at 16.
 */
export const targets = {
  floor: '24px',   // WCAG 2.2 SC 2.5.8 AA floor
  adult: '44px',   // Apple HIG 44pt; Material prefers 48
  teen: '48px',    // Material's 48dp — Hot, grades 6–12
  child: '56px',   // Hot, grades 3–5
  young: '72px',   // ~2cm, NN/g's 4× finding — Hot, K–2 primary actions
} as const;

// ---- navigation chrome geometry (doc 02 §2.1) -------------------------------

/**
 * The nav shell's fixed dimensions, in px for the same reason `targets` is:
 * these are platform-spec numbers, and a rem base of 14 silently shrank them.
 *
 * `rail` is Material 3's OWN collapsed navigation-rail width. The current
 * androidx token is `NavigationRailCollapsedTokens.ContainerWidth = 96.dp`,
 * with `NarrowContainerWidth = 80.dp` as the narrow variant and 220–360dp for
 * the expanded rail — so 96 is the standard, not a deviation, and 80 is the
 * floor we are choosing not to sit on. 96 is also what this product needs
 * independently: the rail carries a label under every icon (DashboardShell's
 * ratified rail rejected icon-only, and doc 36 §4.1 requires visible labels),
 * and it must fit the K–2 `young` 72px emphasis slab with padding, which 80
 * cannot do. iPadOS has no rail primitive to defend against — Apple's nearest
 * equivalents are the sidebar and the floating tab bar — so Material's number
 * is the one that applies.
 *
 * `raised` is the learner Snap slab. iOS has no raised-tab convention at all
 * (it is a custom pattern), so the reference is Material's FAB: 56 standard,
 * 96 large. 64 sits deliberately between them — larger than a standard FAB
 * because it is the product's signature action and must out-weigh every other
 * item on the bar, smaller than a large FAB because it shares the bar rather
 * than floating over content. The age band raises it further and never lowers
 * it (K–2 → 72).
 *
 * `indicator` is the height of the selected-item marker, matching Material's
 * `ActiveIndicatorHeight = 32.dp` (`NavigationBarVerticalItemTokens` /
 * `NavigationRailVerticalItemTokens`, whose paired `ActiveIndicatorWidth` is
 * 56). We keep Material's height and let the width hug the item's content
 * instead of pinning it to 56, because our labels are words rather than
 * Material's single glyph — but it must NOT stretch to fill the tab, which is
 * what made selection read as a button instead of a marker.
 */
export const navChrome = {
  rail: '96px',
  raised: '64px',
  indicator: '32px',
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

// ---- marketing site layer (site spec §5.1 · §5.2) ---------------------------

/**
 * The marketing site's own semantic layer. Everything above this line themes the
 * PRODUCT; everything below themes moyolearn.com, and the two must not be
 * confused for one another.
 *
 * Three rules make this a layer rather than a second design system:
 *
 * 1. **It is theme-independent.** These are flat hex values, not `light-dark()`
 *    pairs, because a marketing page has one ground: warm cream paper. Phase 0's
 *    hero sat on `bg-surface`, which follows the reader's OS preference, so the
 *    site inverted itself on a dark-mode machine and the whole design language —
 *    ink on paper, hard offset shadows in the outline colour — stopped meaning
 *    anything. `.moyo-site` (build-css.mjs) is the scope that makes the ground
 *    explicit; it pins `color-scheme: light` so the product's `light-dark()`
 *    tokens resolve light inside it, and re-points the product's chrome at these
 *    values so `@acme/ui` components render on paper without being restyled.
 * 2. **Only the web output carries it.** There is no native marketing surface,
 *    so emitting these into theme-native.css would grow the mobile app's Uniwind
 *    registry with utilities it can never use.
 * 3. **The six names in the spec are binding**, so the colour keys are camelCase
 *    (`moyoPrimary`) where the rest of this file is kebab. build-css.mjs
 *    kebab-cases them on the way out — the TS key is `moyoPrimary`, the variable
 *    is `--color-moyo-primary`, and the class is `bg-moyo-primary`. Shape and
 *    type maps keep the file's kebab step names; their binding names
 *    (`moyoShadowOffset`, `moyoBorderW`) are the export identifiers.
 *
 * Every value here is measured, not chosen by eye — the ratios are in
 * docs/site/tokens.md and `tooling/check-contrast.mjs` gates them.
 * SOT: docs/site/tokens.md · this file
 * SOT-KEYWORDS: site marketing moyo paper ink tokens palette web-vite
 */
export const siteColors = {
  /** The ground. Warm cream, not white: the site is printed matter, not a screen. */
  moyoPaper: '#F7F1E3',
  /** A card lifted off the ground. Ink on it is 17.99:1. */
  moyoPaperRaised: '#FFFCF2',
  /** A recessed band — the only way a section changes value without changing hue. */
  moyoPaperSunken: '#EFE7D4',
  /** Warm near-black. Never `#000`: pure black on cream reads as a printing error. */
  moyoInk: '#171310',
  /** Secondary prose. 6.91:1 on paper — muted is a value step, never a legibility cut. */
  moyoInkMuted: '#5A5145',
  /**
   * The outline IS the ink. It is a separate token because a section may soften
   * its rules without touching type colour; today it resolves to the same value,
   * which is what makes the 2–4px frames read as drawn rather than as chrome.
   */
  moyoOutline: '#171310',
  /**
   * Logo plum. The darkest brand hue and the only chromatic fill that accepts
   * paper-coloured type. 11.88:1 on paper: safe for links, labels and the
   * primary action.
   */
  moyoPrimary: '#3C2357',
  /** Logo plum in its annotation role; safe for body text on paper. */
  moyoSecondary: '#3C2357',
  /** Logo coral. A fill and large accent; ink on it clears AA at 5.03:1. */
  moyoHeart: '#E55545',
  /** Logo orange. Fill only; ink on it clears AA at 9.09:1. */
  moyoSun: '#F4A629',
  /** Coral alias used by the globe's warm land and existing section fills. */
  moyoEarth: '#E55545',
  /** Teal alias used by the globe's cool land and existing section fills. */
  moyoLeaf: '#0A9299',

  /*
    THE IDENTITY PAIR. These two are the Moyo logo's own colours, so they are
    named for the mark rather than for a hue or for whatever they happen to be
    colouring this month — the same discipline the file's opening warning
    demands, applied before the name has a chance to become a lie. They are
    first-class site tokens, usable on the wordmark, a chapter accent, the
    footer signature or a landmass. `moyoPrimary` now points at the same plum;
    the alias remains because "mark deep" describes identity while "primary"
    describes interaction hierarchy.
  */
  /**
   * The mark's teal. 3.34:1 on paper, so it is fill-only or large display type.
   * Ink on it is 5.74:1.
   */
  moyoMark: '#0A9299',
  /**
   * The mark's plum. 11.88:1 on paper — the darkest chromatic token in the
   * layer and safe at any size. Its one hazard is at the other end: `moyoInk`
    * on it is 1.38:1, so the outline that frames every other fill VANISHES on
   * this one. Anything drawn in plum needs its own separation.
   */
  moyoMarkDeep: '#3C2357',

  // Foregrounds. Paper rather than white on every chromatic fill: a white knockout
  // on a cream page reads as a hole punched through it.
  moyoOnPrimary: '#F7F1E3',
  moyoOnSecondary: '#F7F1E3',
  moyoOnHeart: '#171310',
  moyoOnSun: '#171310',
  moyoOnEarth: '#171310',
  moyoOnLeaf: '#171310',
  /** Ink, not paper: paper on teal fails, ink on it clears AA at 5.74:1. */
  moyoOnMark: '#171310',
  moyoOnMarkDeep: '#F7F1E3',
} as const;

/**
 * Hard offset shadows — x/y steps, **zero blur, always**. A blurred shadow is a
 * different design language and there is no token for one.
 *
 * The offset is stored on its own (`--moyo-shadow-offset-*`) as well as composed
 * into the Tailwind shadow namespace, because a chapter that animates depth
 * needs the scalar, not the finished string.
 */
export const moyoShadowOffset = {
  1: '0.1875rem', // 3px — a rule that has lifted off the page
  2: '0.375rem', // 6px — the default card
  3: '0.625rem', // 10px — a hero slab
  4: '1rem', // 16px — one per page, at most
} as const;

/**
 * Border widths. 2px is the floor: below it the frame stops reading as drawn.
 *
 * Emitted as custom properties AND as `.border-moyo-*` classes, because Tailwind
 * builds `border-2` from a bare number and has no border-width theme namespace —
 * a `border-moyo-rule` utility would otherwise be silently inert, which is the
 * exact class of bug `tooling/check-runtime-classes.mjs` exists to catch.
 */
export const moyoBorderW = {
  hair: '2px',
  rule: '3px',
  slab: '4px',
} as const;

/**
 * The radius law: mostly square, with ONE small step for tactile cards. Two
 * entries, deliberately — a third would turn a law into a scale.
 */
export const moyoRadius = {
  square: '0rem',
  card: '0.25rem',
} as const;

/**
 * Paper grain. 2–4% is the whole range: at 5% it is grunge, and the design
 * language is a clean workbook, not a distressed poster.
 */
export const moyoTexture = {
  grain: '0.03',
} as const;

/**
 * The site's motion vocabulary (site spec §10). Objects on moyolearn.com have
 * physical personalities — a card thunks, a sticker peels, a page turns — and
 * this is where each personality's physics is spelled ONCE so a chapter never
 * types a duration, an ease, a distance or an overshoot at a call site.
 *
 * Four things about the shape are deliberate:
 *
 * 1. **`duration` is ms strings**, matching `motion.duration` above, because
 *    build-css.mjs emits them as `--moyo-duration-*` for the CSS-transition
 *    micro-interactions. `apps/web-vite/src/motion/tokens.ts` is the one place
 *    that converts them to the seconds GSAP wants.
 * 2. **`ease` values are GSAP ease identifiers, not cubic-beziers**, and they
 *    are deliberately NOT emitted as CSS. GSAP is the site's only animation
 *    system, `power4.out` has no CSS spelling, and re-encoding each curve as a
 *    bezier would be two sources for one shape. CSS transitions use the
 *    product's `--ease-*` tokens; anything needing these curves is a timeline.
 * 3. **Nothing here is a generic "fade up".** The easing law is that an element
 *    with no personality assigned does not animate, so there is no default
 *    entrance token to reach for by accident.
 * 4. `compress` has no travel entry on purpose: a button compresses *toward its
 *    own shadow*, so its distance is `moyoShadowOffset[1]` and inventing a
 *    second number here would let the two drift.
 *
 * SOT: docs/site/motion-matrix.md · apps/web-vite/src/motion/primitives.ts
 * SOT-KEYWORDS: site motion tokens gsap duration ease personality thunk peel
 *               snap draw page-turn compress pulse marketing
 */
export const siteMotion = {
  /**
   * Entrances are decisive (300–500ms) and settles are short. `pulse` is the
   * one slow value in the set — it is the only ambient, repeating motion on the
   * site, and it exists solely for the mark while Natalie is listening.
   */
  duration: {
    thunk: '300ms',
    /** The hard landing after a thunk's overshoot. Short enough to read as impact. */
    settle: '110ms',
    open: '460ms',
    peel: '380ms',
    draw: '520ms',
    /** A strike-through is fast and final; a slow one reads as indecision. */
    'cross-out': '220ms',
    /** Quick or it is not a snap. */
    snap: '200ms',
    /** The heaviest object on the site, and still under the 600ms ceiling. */
    'page-turn': '560ms',
    /** Below the ramp's `fast`: a button under a finger has to feel simultaneous. */
    compress: '80ms',
    release: '160ms',
    'lock-in': '260ms',
    /** One full breath. Ambient movement is slow and rare. */
    pulse: '1800ms',
  },
  ease: {
    entrance: 'power3.out',
    /** Decelerates harder than `entrance`: a card that lands, not one that arrives. */
    thunk: 'power4.out',
    settle: 'power2.out',
    snap: 'power4.out',
    /** A pencil accelerates into the stroke and lifts off it. */
    draw: 'power2.inOut',
    peel: 'power2.out',
    /** A page has mass at both ends of the turn. */
    turn: 'power2.inOut',
    strike: 'power4.out',
    compress: 'power2.out',
    release: 'power3.out',
    /** The only cyclical ease. Anything else makes a breath read as a machine. */
    breath: 'sine.inOut',
    lock: 'power4.out',
  },
  /** Multipliers past the rest state. The spec's ceiling for a thunk is 3%. */
  overshoot: {
    thunk: 1.025,
    snap: 1.02,
  },
  /** Distances, in rem so they scale with the root the type ramp is built on. */
  travel: {
    thunk: '1.5rem',
    peel: '0.5rem',
    snap: '1.25rem',
    'page-turn': '3rem',
    'lock-in': '0.75rem',
    /*
      Parallax depth inside a PINNED chapter. The five entrance travels above
      are sized for an object arriving into its own slot; across four viewports
      of pinned scroll they read as nothing at all, because in a pin the layer
      differential IS the whole effect and there is no page movement underneath
      it to borrow from. Three steps, roughly a ratio apart, so a composition
      can say far/mid/near without a chapter inventing a fourth depth.
    */
    'parallax-far': '2rem',
    'parallax-mid': '5rem',
    'parallax-near': '8rem',
  },
  /**
   * Rotations, as unsigned MAGNITUDES. Direction belongs to the primitive — a
   * workbook hinged on its right spine opens the other way, and a token that
   * carried the sign would need a second entry for the mirror. Every one of
   * these exists to keep an object off-axis: a hand drew it.
   */
  rotate: {
    peel: '6deg',
    'page-turn': '12deg',
    strike: '2deg',
    /** Past vertical, the way a workbook cover actually falls open. */
    open: '105deg',
    /** The ceiling on a draggable's rotational inertia. "Slight" is the brief. */
    drag: '7deg',
    snap: '3deg',
  },
  scale: {
    peel: 1.04,
    snap: 0.92,
    pulse: 1.04,
    /**
     * A full-bleed figure entering OVERSIZED and cropped by its own stage,
     * settling to true size. Deliberately an order of magnitude past `peel`:
     * the others are the few percent an object overshoots by, this is the
     * composition being wider than the frame on purpose.
     */
    crop: 1.25,
  },
  opacity: {
    /** The floor of the listening breath. It softens; it never disappears. */
    pulse: 0.82,
  },
} as const;

/**
 * The site's faces (§5.2). Self-hosted woff2 only — `apps/web-vite/src/fonts.css`
 * declares the `@font-face` rules against `apps/web-vite/public/fonts/`, and no
 * request to a font CDN is emitted from any surface.
 *
 * Each stack names a `* Fallback` face before the system fallback. Those are
 * `local()`-backed `@font-face` blocks carrying measured `size-adjust` and
 * ascent/descent overrides, so the swap from fallback to webfont does not move a
 * single line and CLS stays ~0. The metrics are in docs/site/tokens.md.
 *
 * Two voices only: Clash Display for authored headings and General Sans for
 * everything read or operated. Notes use weight, angle and placement rather
 * than loading a third novelty face; pull-quotes use scale rather than a serif.
 */
export const siteFontFamilies = {
  moyoDisplay: "'Clash Display', 'Clash Display Fallback', 'Arial Black', sans-serif",
  moyoText: "'General Sans', 'General Sans Fallback', system-ui, sans-serif",
  moyoSerif: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  moyoHand: "'Shantell Sans', 'Comic Sans MS', cursive",
} as const;

/**
 * The fluid site ramp. Every step is a `clamp()`, so there is no breakpoint at
 * which type jumps — the page is one continuous composition from 320px to 2560px
 * and the display sizes do the dramatic-scale work the brief asks for.
 *
 * `site-hero` is the spec's `clamp(64px, 12vw, 200px)` in rem. Leading tightens
 * as size grows (0.88 at hero, 1.6 at body) because a 200px line set at 1.2
 * leaves a corridor of dead space no layout can absorb.
 *
 * Keys stay kebab like `typeScale`, so Tailwind emits `text-site-hero` directly.
 * Every key must also appear in `RAMP_FONT_SIZES` in packages/ui/tv.ts or
 * tailwind-merge reads it as a COLOUR and deletes it — see that file's header.
 */
export const siteTypeScale = {
  /** The one hero moment per page. Clash Display, tight, unapologetic. */
  'site-hero': { size: 'clamp(2.75rem, 7.5vw, 7rem)', lineHeight: '0.94', tracking: '-0.02em' },
  /** Chapter openers. */
  'site-chapter': { size: 'clamp(2rem, 4.6vw, 4rem)', lineHeight: '1.02', tracking: '-0.02em' },
  'site-title': { size: 'clamp(2rem, 4vw, 3.25rem)', lineHeight: '1.05', tracking: '-0.02em' },
  'site-subtitle': {
    size: 'clamp(1.375rem, 2.4vw, 1.875rem)',
    lineHeight: '1.15',
    tracking: '-0.01em',
  },
  /** The paragraph directly under a display moment. */
  'site-lead': { size: 'clamp(1.125rem, 1.6vw, 1.375rem)', lineHeight: '1.5', tracking: '0' },
  'site-body': { size: 'clamp(1rem, 1.05vw, 1.125rem)', lineHeight: '1.6', tracking: '0' },
  /** Eyebrows and structural labels. Tracked open because it is set in caps. */
  'site-label': {
    size: 'clamp(0.8125rem, 0.9vw, 0.875rem)',
    lineHeight: '1.3',
    tracking: '0.08em',
  },
  /** Display scale for pull-quotes; type family is chosen by the component. */
  'site-quote': { size: 'clamp(1.5rem, 3vw, 2.5rem)', lineHeight: '1.2', tracking: '-0.01em' },
  /** General Sans note scale; placement and weight carry its annotation role. */
  'site-note': { size: 'clamp(0.9375rem, 1.1vw, 1.0625rem)', lineHeight: '1.45', tracking: '0' },
} as const;

export type Palette = typeof palette;
export type SemanticColor = keyof typeof semantic;
export type ContentWidth = keyof typeof contentWidths;
export type SiteColor = keyof typeof siteColors;
export type SiteTypeStep = keyof typeof siteTypeScale;
export type SiteFontFamily = keyof typeof siteFontFamilies;
export type SiteMotionDuration = keyof typeof siteMotion.duration;
export type SiteMotionEase = keyof typeof siteMotion.ease;
