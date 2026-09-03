#!/usr/bin/env node
// WCAG contrast gate over every foreground/background token pair, both themes.
// Doc 02 §7.2: "automated WCAG contrast check over every fg/bg token pair;
// failing pair fails the build." A palette that only looks accessible is a
// child-outcome problem, so this runs in `pnpm lint`, not in review.
//
// Pairs are DERIVED wherever the token system can name them (on-* carried
// foregrounds, accentRoles, resourceAccents × the classes the schedule really
// renders) and declared only where no naming convention exists to derive from.
// The declared-only design shipped a live AA failure (white on the schedule's
// selected accents) and silently skipped two of the seven role accents when
// roles grew — a pairing nobody adds is a pairing nobody checks, so nothing a
// list can derive is allowed to be a list any more.
// SOT: docs/pack/02-adaptive-screens-design-spec.md §7.2 · packages/theme/tokens.ts
// SOT-KEYWORDS: contrast wcag accessibility a11y tokens colour check gate derived
// ponytail: the maths is eight lines of sRGB — a colour library would be a
// dependency to avoid writing them. (packages/theme/tenant.ts carries the same
// luminance maths for runtime brand resolution; this stays dependency-free
// because tenant.ts is TS-typed for the app while this must run bare in lint.)
import {
  palette,
  semantic,
  siteColors,
  accentRoles,
  resourceAccents,
} from '../packages/theme/tokens.ts';
// Safe to import from a feature: its only dependency is a type-only import,
// which Node's type stripping erases, so no app code actually loads.
import { ACCENT_CLASSES } from '../packages/app/features/schedule/accent-classes.ts';

/** WCAG 2.1 relative luminance. Accepts #rgb, #rrggbb, and rgba() over a known backdrop. */
const channels = (colour) => {
  const hex = colour.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).concat(1);
  }
  const m = hex.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(',').map((n) => parseFloat(n));
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts.length > 3 ? parts[3] : 1];
};

/** Composite a possibly-translucent colour over its backdrop before measuring. */
const flatten = (fg, bg) => {
  const f = channels(fg);
  const b = channels(bg);
  if (!f || !b) return null;
  const a = f[3];
  return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (fg, bg) => {
  const f = flatten(fg, bg);
  const b = channels(bg);
  if (!f || !b) return null;
  const [l1, l2] = [luminance(f), luminance(b.slice(0, 3))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/**
 * Declared pairs — ONLY those no convention can derive. `min` is the bar this
 * pair must clear:
 *   4.5 — WCAG AA body text
 *   3.0 — AA large text (>=18.66px bold / 24px) and UI component boundaries (1.4.11)
 * Body text lands on surfaces, marks are drawn on paper, boundaries carry
 * meaning — none of those relationships is encoded in a token NAME, so they
 * stay declared. Everything a name does encode (`on-X` rides `X`,
 * `on-role-accent` rides every `role-*`) is derived below and must never be
 * re-added here by hand.
 */
const PAIRS = [
  // body text on every surface it can land on
  ['text', 'surface', 4.5],
  ['text', 'surface-raised', 4.5],
  ['text', 'surface-sunken', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-raised', 4.5],
  ['text-muted', 'surface-sunken', 4.5],
  ['text-inverse', 'text', 4.5],
  // schoolhouse marks are drawn ON paper, so each must survive both surfaces
  ['ballpoint', 'surface', 4.5],
  ['ballpoint', 'surface-raised', 4.5],
  ['redpen', 'surface', 4.5],
  ['redpen', 'surface-raised', 4.5],
  ['grade', 'surface', 4.5],
  ['grade', 'surface-raised', 4.5],
  // non-text boundaries: WCAG 1.4.11 asks 3:1 of anything carrying meaning
  ['border', 'surface', 3],
  ['border-strong', 'surface', 3],
  ['border-soft', 'surface', 3],
  ['focus', 'surface', 3],
  ['danger', 'surface', 3],
];

/**
 * Derived pairs, from the semantic token names themselves.
 *
 * 1. Carried foregrounds: every `on-<base>` token rides `<base>` (and
 *    `<base>-pressed` where one exists) at the 4.5 body bar. Mint a new fill
 *    with its `on-*` and the pair is checked before any component renders it.
 * 2. Role accents (doc 36 §5): ink rides every door's accent identically, and
 *    the bar is 14 — parity with ink-on-highlighter (learner measures 14.36:1,
 *    which IS the bar), not mere AA. A hue tweak that drops under it breaks
 *    "one product, five doors" long before WCAG. Derived from `accentRoles`,
 *    the same list that drives the `.role-*` scopes, so an eighth role cannot
 *    reach a shell unchecked — the old hand-list missed teacher and school for
 *    exactly as long as they existed (teacher measured 13.09:1, unnoticed).
 */
const DERIVED_PAIRS = [];
for (const name of Object.keys(semantic)) {
  const m = name.match(/^on-(.+)$/);
  if (!m || m[1].startsWith('role-')) continue; // role pairs carry the 14 bar below
  const base = m[1];
  if (!semantic[base]) {
    console.error(`token ${name} has no ${base} to ride — carried foreground without a fill`);
    process.exitCode = 1;
  }
  DERIVED_PAIRS.push([name, base, 4.5]);
  if (semantic[`${base}-pressed`]) DERIVED_PAIRS.push([name, `${base}-pressed`, 4.5]);
}
DERIVED_PAIRS.push(['on-role-accent', 'role-accent', 14]);
for (const role of accentRoles) DERIVED_PAIRS.push(['on-role-accent', `role-${role}`, 14]);

/**
 * Tenant shell tokens are overridable at runtime, so the DEFAULT values in
 * tokens.ts must clear contrast for the build. Admins can pick from the curated
 * palette only, which is what guarantees real documents stay accessible.
 * Declared: the `tenant-*-foreground` suffix convention is close to derivable,
 * but half these pairs (success/warning/danger on tenant-surface, border and
 * ring bars) are not, and a half-derived layer would invite hand additions
 * back into the derived half.
 */
const TENANT_PAIRS = [
  ['tenant-header-foreground', 'tenant-header', 4.5],
  ['tenant-header-muted', 'tenant-header', 4.5],
  ['tenant-sidebar-foreground', 'tenant-sidebar', 4.5],
  ['tenant-sidebar-muted', 'tenant-sidebar', 4.5],
  /*
    HEADER ink on the SIDEBAR plane, which is a real pairing and not a typo.
    The drawer is the rail in overlay form, so it wears `tenant-sidebar` in both
    shells — but the controls and links that ride it come from the header
    vocabulary: `NavDrawerButton`'s glyph is one component in two places (top
    bar and drawer) and keeps one ink, and the Hot shell's drawer reuses
    `HotNavLink`, which is the same component as the desktop header pill.
    Declared rather than derived because no naming convention says a
    `tenant-header-*` foreground may land on `tenant-sidebar` — which is exactly
    why it needs measuring.
  */
  ['tenant-header-foreground', 'tenant-sidebar', 4.5],
  ['tenant-header-muted', 'tenant-sidebar', 4.5],
  ['tenant-sidebar-active-foreground', 'tenant-sidebar-active', 4.5],
  ['tenant-primary-foreground', 'tenant-primary', 4.5],
  ['tenant-primary-foreground', 'tenant-primary-hover', 4.5],
  ['tenant-accent-foreground', 'tenant-accent', 4.5],
  ['tenant-success', 'tenant-surface', 4.5],
  ['tenant-warning', 'tenant-surface', 4.5],
  ['tenant-danger', 'tenant-surface', 4.5],
  ['tenant-border', 'tenant-surface', 3],
  ['tenant-focus-ring', 'tenant-surface', 3],
  ['tenant-border', 'tenant-surface-subtle', 3],
  ['tenant-focus-ring', 'tenant-surface-subtle', 3],
];

/**
 * `border-faint` is the Cool dial's 10% shadow ink. It is deliberately invisible
 * and carries no meaning on its own, so it is exempt — named here so the
 * exemption is a decision on the record rather than an oversight.
 */
const EXEMPT = new Set(['border-faint']);

/**
 * The marketing site layer (tokens.ts `siteColors`). One dimension, not two:
 * the site has a single ground by design, so there is no per-theme axis here —
 * that IS the design decision, and `.moyo-site` pins `color-scheme: light` to
 * enforce it.
 *
 * `min` is read the same way as PAIRS above. Three entries sit at 3.0 and each
 * says why on its own line; everything a reader has to read at body size is at
 * 4.5. Ratios are reproduced in docs/site/tokens.md — this is what generates
 * them, so the doc cannot drift from the palette without this failing first.
 */
const SITE_PAIRS = [
  // ink on every ground it can land on
  ['moyoInk', 'moyoPaper', 4.5],
  ['moyoInk', 'moyoPaperRaised', 4.5],
  ['moyoInk', 'moyoPaperSunken', 4.5],
  ['moyoInkMuted', 'moyoPaper', 4.5],
  ['moyoInkMuted', 'moyoPaperRaised', 4.5],
  ['moyoInkMuted', 'moyoPaperSunken', 4.5],
  // chromatic FILL text — tokens.ts marks these as large-text/display only.
  ['moyoPrimary', 'moyoPaper', 4.5],
  ['moyoPrimary', 'moyoPaperRaised', 4.5],
  ['moyoSecondary', 'moyoPaper', 4.5],
  ['moyoSecondary', 'moyoPaperRaised', 4.5],
  // moyoHeart, moyoEarth, moyoLeaf and moyoMark are large/display marks, never
  // paragraphs or captions. docs/site/tokens.md carries the restriction.
  ['moyoHeart', 'moyoPaper', 3],
  ['moyoHeart', 'moyoPaperRaised', 3],
  ['moyoEarth', 'moyoPaper', 3],
  ['moyoEarth', 'moyoPaperRaised', 3],
  ['moyoLeaf', 'moyoPaper', 3],
  ['moyoLeaf', 'moyoPaperRaised', 3],
  /*
    The identity plum is the darkest chromatic token in the layer, so it is held
    to the full body bar like every other mark.
  */
  ['moyoMarkDeep', 'moyoPaper', 4.5],
  ['moyoMarkDeep', 'moyoPaperRaised', 4.5],
  // chromatic FILLS carry their own foreground
  ['moyoOnPrimary', 'moyoPrimary', 4.5],
  ['moyoOnSecondary', 'moyoSecondary', 4.5],
  ['moyoOnHeart', 'moyoHeart', 4.5],
  ['moyoOnSun', 'moyoSun', 4.5],
  ['moyoOnEarth', 'moyoEarth', 4.5],
  ['moyoOnLeaf', 'moyoLeaf', 4.5],
  ['moyoOnMark', 'moyoMark', 4.5],
  ['moyoOnMarkDeep', 'moyoMarkDeep', 4.5],
  // non-text boundaries: WCAG 1.4.11
  ['moyoOutline', 'moyoPaper', 3],
  ['moyoOutline', 'moyoPaperRaised', 3],
  ['moyoOutline', 'moyoPaperSunken', 3],
  ['moyoOutline', 'moyoSun', 3],
  /*
    Cobalt display type on a sun block is 4.38:1 — the one pairing in the layer
    that is LARGE-TEXT ONLY. Checked at 3.0 rather than dropped, because a
    pairing nobody declares is a pairing nobody measures, and
    docs/site/tokens.md marks it as restricted.
  */
  ['moyoPrimary', 'moyoSun', 3],
  /*
    The identity teal on paper is 3.63:1 — the SECOND large-text-only pairing in
    the layer, and the reason it is declared here at 3.0 rather than omitted is
    the same as for cobalt-on-sun: a pairing nobody declares is a pairing nobody
    measures. It is a wordmark and display colour, never a paragraph and never a
    caption. docs/site/tokens.md carries the restriction.
  */
  ['moyoMark', 'moyoPaper', 3],
  ['moyoMark', 'moyoPaperRaised', 3],
];

/**
 * `moyoSun` is the site's `highlighter`: a FILL that can never carry type
 * (1.69:1 against paper) and never draws a border or a focus ring. It is exempt
 * as a FOREGROUND only — every pairing where it is the background is above.
 */
const SITE_FILL_ONLY = new Set(['moyoSun']);

// ---- schedule resource accents ----------------------------------------------
// Derived from the CLASS STRINGS the schedule actually renders, not from a
// step constant transcribed here: `resourceAccents` (tokens.ts) names every
// family, ACCENT_CLASSES (the feature) names every colour placed on screen,
// and this resolves those Tailwind utilities back to token values and measures
// them. Reintroduce `text-white` over a 500 fill and this fails at 3.44:1;
// add a sixth family to tokens.ts and this fails until the schedule ships
// classes for it. 4.5, not 3.0: EventBlock draws the title at 14px semibold
// and the time at 12px — body text, so the large-text allowance never applies.

/** `bg-ember-500/10` → rgba string; `text-on-accent` → semantic value; `text-white` → #FFFFFF. */
const resolveUtility = (cls, theme) => {
  const body = cls.replace(/^(bg|text)-/, '');
  const [name, alphaPct] = body.split('/');
  let base = null;
  if (name === 'white') base = palette.white;
  else if (semantic[name]) base = semantic[name][theme];
  else {
    const m = name.match(/^([a-z-]+)-(\d+)$/);
    if (m && palette[m[1]]?.[m[2]]) base = palette[m[1]][m[2]];
  }
  if (!base) return null;
  if (!alphaPct) return base;
  const c = channels(base);
  if (!c) return null;
  return `rgba(${c[0] * 255}, ${c[1] * 255}, ${c[2] * 255}, ${Number(alphaPct) / 100})`;
};

/** The bg-/text- utility active under `theme`: last `dark:` class wins in dark, else the base class. */
const activeUtility = (className, theme, kind) => {
  const parts = className.split(/\s+/).filter(Boolean);
  const pick = (list) => list.filter((c) => c.startsWith(`${kind}-`)).at(-1);
  const dark = pick(parts.filter((c) => c.startsWith('dark:')).map((c) => c.slice(5)));
  const light = pick(parts.filter((c) => !c.includes(':')));
  return (theme === 'dark' ? (dark ?? light) : light) ?? null;
};

/** Tinted blocks sit on the app surface, so flatten translucent fills before measuring. */
const groundedBg = (colour, theme) => {
  const c = channels(colour);
  if (!c) return null;
  if (c[3] === 1) return colour;
  const merged = flatten(colour, semantic.surface[theme]);
  return merged ? `rgb(${merged.map((v) => v * 255).join(', ')})` : null;
};

const THEMES = ['light', 'dark'];
let failures = 0;
let checked = 0;

for (const theme of THEMES) {
  const rows = [];
  for (const [fgName, bgName, min] of [...PAIRS, ...DERIVED_PAIRS]) {
    if (EXEMPT.has(fgName) || EXEMPT.has(bgName)) continue;
    const fg = semantic[fgName]?.[theme];
    const bg = semantic[bgName]?.[theme];
    if (!fg || !bg) {
      console.error(`unknown token in pair: ${fgName} on ${bgName}`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    if (r === null) {
      console.error(`could not parse colour for ${fgName} on ${bgName} (${fg} / ${bg})`);
      failures++;
      continue;
    }
    checked++;
    if (r < min) {
      failures++;
      rows.push(`  FAIL  ${fgName} on ${bgName}  ${r.toFixed(2)}:1  (needs ${min}:1)`);
    }
  }
  if (rows.length) {
    console.error(`\n${theme}:`);
    rows.forEach((r) => console.error(r));
  }

  const tenantRows = [];
  for (const [fgName, bgName, min] of TENANT_PAIRS) {
    if (EXEMPT.has(fgName) || EXEMPT.has(bgName)) continue;
    const fg = semantic[fgName]?.[theme];
    const bg = semantic[bgName]?.[theme];
    if (!fg || !bg) {
      console.error(`unknown tenant token in pair: ${fgName} on ${bgName}`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    if (r === null) {
      console.error(`could not parse colour for ${fgName} on ${bgName} (${fg} / ${bg})`);
      failures++;
      continue;
    }
    checked++;
    if (r < min) {
      failures++;
      tenantRows.push(`  FAIL  ${fgName} on ${bgName}  ${r.toFixed(2)}:1  (needs ${min}:1)`);
    }
  }
  if (tenantRows.length) {
    console.error(`\n${theme} tenant:`);
    tenantRows.forEach((r) => console.error(r));
  }

  // schedule event tones — selected block and resting tint, from the real classes
  const scheduleRows = [];
  for (const accent of resourceAccents) {
    const entry = ACCENT_CLASSES[accent];
    if (!entry) {
      console.error(
        `resource accent "${accent}" is in tokens.ts but has no ACCENT_CLASSES entry — ` +
          'the schedule cannot render it and this gate cannot measure it.',
      );
      failures++;
      continue;
    }
    const cases = [
      ['selected title', entry.selectedTitle, entry.selectedSurface],
      ['resting title', entry.title, entry.surface],
    ];
    for (const [label, titleClass, surfaceClass] of cases) {
      const fgCls = activeUtility(titleClass, theme, 'text');
      const bgCls = activeUtility(surfaceClass, theme, 'bg');
      const fg = fgCls && resolveUtility(fgCls, theme);
      const bgRaw = bgCls && resolveUtility(bgCls, theme);
      const bg = bgRaw && groundedBg(bgRaw, theme);
      if (!fg || !bg) {
        console.error(
          `could not resolve schedule ${label} for ${accent} (${titleClass} on ${surfaceClass})`,
        );
        failures++;
        continue;
      }
      const r = ratio(fg, bg);
      checked++;
      if (r === null || r < 4.5) {
        failures++;
        scheduleRows.push(
          `  FAIL  ${accent} ${label}  ${fgCls} on ${bgCls}  ${r === null ? '?' : r.toFixed(2)}:1  (needs 4.5:1)` +
            '\n        This is the schedule event block. Move the step or the foreground token, not the threshold.',
        );
      }
    }
  }
  if (scheduleRows.length) {
    console.error(`\n${theme} schedule accents:`);
    scheduleRows.forEach((r) => console.error(r));
  }
}

const siteRows = [];
for (const [fgName, bgName, min] of SITE_PAIRS) {
  const fg = siteColors[fgName];
  const bg = siteColors[bgName];
  if (!fg || !bg) {
    console.error(`unknown site token in pair: ${fgName} on ${bgName}`);
    failures++;
    continue;
  }
  if (SITE_FILL_ONLY.has(fgName)) {
    console.error(
      `${fgName} is fill-only and cannot be a foreground — remove the pair, don't lower the bar.`,
    );
    failures++;
    continue;
  }
  const r = ratio(fg, bg);
  checked++;
  if (r === null || r < min) {
    failures++;
    siteRows.push(
      `  FAIL  ${fgName} on ${bgName}  ${r === null ? '?' : r.toFixed(2)}:1  (needs ${min}:1)`,
    );
  }
}
if (siteRows.length) {
  console.error('\nmarketing site layer:');
  siteRows.forEach((r) => console.error(r));
}

if (failures || process.exitCode === 1) {
  console.error(
    `\n${failures} contrast failure(s). Fix the value in packages/theme/tokens.ts — ` +
      'not the threshold, and not by hoping the surface underneath is lighter in practice.',
  );
  process.exit(1);
}
console.log(
  `contrast OK — ${checked} token pairs (${DERIVED_PAIRS.length} derived + schedule accents) across ${THEMES.join(' + ')} meet WCAG AA`,
);
