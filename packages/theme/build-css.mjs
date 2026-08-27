// Emits theme.css + theme-native.css (Tailwind v4 @theme variables) from
// tokens.ts — the single source.
// Run: node build-css.mjs   (both are committed; CI can diff-check for drift)
// SOT: ./tokens.ts
// SOT-KEYWORDS: theme css build tailwind generate variables native-css
//
// TWO self-contained outputs, because the two styling engines disagree about
// where a themed variable lives:
//
//   theme.css        web + storybook (plain Tailwind 4 / react-native-css).
//                    Semantic colors are @theme entries using light-dark(), so
//                    system-following is free and [data-theme] flips it by
//                    overriding color-scheme.
//   theme-native.css mobile (Uniwind). Uniwind has no light-dark(); it reads
//                    themes from `@layer theme { :root { @variant <name> } }`
//                    and registers utilities straight from those blocks.
//
// They duplicate the non-semantic tokens on purpose — generated duplication is
// free, whereas cross-file @import resolution inside a package is not.
import { writeFileSync } from 'node:fs';
import {
  palette, semantic, fontFamilies, typeScale, contentWidths,
  radius, shadows, zIndex, motion, breakpoints, dial,
  uiRamp, spacingTiers, targets, readingComfort, accentRoles,
} from './tokens.ts';

const HEADER = '/* GENERATED from tokens.ts — do not edit by hand. `node build-css.mjs` */';

// Everything that is theme-independent: identical in both outputs.
const sharedThemeTokens = () => {
  const out = [];

  // primitive palettes
  for (const [name, scale] of Object.entries(palette)) {
    if (typeof scale === 'string') {
      out.push(`  --color-${name}: ${scale};`);
    } else {
      for (const [step, hex] of Object.entries(scale)) {
        out.push(`  --color-${name}-${step}: ${hex};`);
      }
    }
  }

  // typography — iterated, so adding a family to tokens.ts emits it here too
  // instead of silently doing nothing until someone notices the missing variable.
  for (const [name, stack] of Object.entries(fontFamilies)) {
    out.push(`  --font-${name}: ${stack};`);
  }
  for (const [name, t] of Object.entries(typeScale)) {
    out.push(`  --text-${name}: ${t.size};`);
    out.push(`  --text-${name}--line-height: ${t.lineHeight};`);
    out.push(`  --text-${name}--letter-spacing: ${t.tracking};`);
  }

  // content widths → max-w-content-* utilities
  for (const [name, width] of Object.entries(contentWidths)) {
    out.push(`  --container-${name}: ${width};`);
  }

  for (const [name, value] of Object.entries(radius)) {
    out.push(`  --radius-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(shadows)) {
    out.push(`  --shadow-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(motion.easing)) {
    out.push(`  --ease-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(breakpoints)) {
    out.push(`  --breakpoint-${name}: ${value};`);
  }

  // The dial, emitted per temperature into the namespaces Tailwind already owns,
  // so `rounded-hot` / `shadow-cool` / `p-inset-hot` come out for free. Iterated:
  // a third temperature (doc 02 §5.4 flags `hot-muted` as an open question for
  // teens) emits by editing tokens.ts alone.
  for (const [temp, props] of Object.entries(dial)) {
    out.push(`  --radius-${temp}: ${props.radius};`);
    out.push(`  --shadow-${temp}: ${props.shadow};`);
    out.push(`  --spacing-row-${temp}: ${props['row-height']};`);
    out.push(`  --duration-${temp}: ${props.duration};`);
  }

  /*
    UI ramp. The GENERIC name has to be declared here, not only inside the dial
    scopes: Tailwind generates a utility from what it finds in @theme, so if
    `--text-title` exists only in `.dial-cool`, the class `text-title` is never
    generated and every use of it is silently inert. (This is exactly why
    --radius-card dials correctly — it has always been an @theme entry — and why
    the ramp did not until this default was added.)

    The default is the Cool value, matching <Dial>'s own default: a component
    rendered outside any Dial gets ops chrome, and the scope re-points it.
  */
  for (const [name, byDial] of Object.entries(uiRamp)) {
    const [size, lineHeight, weight] = byDial.cool;
    out.push(`  --text-${name}: ${size};`);
    out.push(`  --text-${name}--line-height: ${lineHeight};`);
    out.push(`  --text-${name}--font-weight: ${weight};`);
    for (const [temp, [s, lh, w]] of Object.entries(byDial)) {
      out.push(`  --text-${name}-${temp}: ${s};`);
      out.push(`  --text-${name}-${temp}--line-height: ${lh};`);
      out.push(`  --text-${name}-${temp}--font-weight: ${w};`);
    }
  }

  // Spacing tiers → p-inset, gap-stack, gap-group, … Same rule: the generic
  // name must exist in @theme or the utility is never generated.
  for (const [name, byDial] of Object.entries(spacingTiers)) {
    out.push(`  --spacing-${name}: ${byDial.cool};`);
    for (const [temp, value] of Object.entries(byDial)) {
      out.push(`  --spacing-${name}-${temp}: ${value};`);
    }
  }

  // Age-band targets are NOT dial-scoped: the band comes from the learner
  // profile, so a screen picks min-h-target-child explicitly (doc 08 §2.4).
  for (const [name, value] of Object.entries(targets)) {
    out.push(`  --spacing-target-${name}: ${value};`);
  }
  return out;
};

// non-Tailwind-namespace vars: z-index + durations
const rootVars = () => {
  const out = [];
  for (const [name, value] of Object.entries(zIndex)) {
    out.push(`  --z-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(motion.duration)) {
    out.push(`  --duration-${name}: ${value};`);
  }
  return out;
};

// Default body text color for the tw Text/heading/paragraph wrappers. Lives in
// the base layer so any explicit text-color utility (utilities layer) overrides
// it on web; on native the runtime resolves by class order, where it comes first.
const BODY_TEXT_BASE = `@layer base {
  .text-body-default { color: var(--color-text); }
}`;

// Chivo Mono ships `tnum` and `zero`, but BOTH ARE OFF UNTIL ASKED FOR. Without
// this rule the mono's default 0 sits a hair away from O — the exact ambiguity the
// face was chosen to avoid — and columns of times drift. Setting it on the family
// rather than per call site means nobody has to remember it.
// Only the family is targeted, so an explicit numeric utility still wins (utilities
// layer beats base), and `font-mono` keeps setting just the family.
const MONO_NUMERICS_WEB = `@layer base {
  .font-mono { font-variant-numeric: tabular-nums slashed-zero; }
}`;

/**
 * The dial as a SCOPE, not a prop on every component.
 *
 * `.dial-hot` / `.dial-cool` re-point the generic chrome tokens at that
 * temperature's values. Because both engines inherit custom properties down the
 * tree (react-native-css resolves through `inheritedVariables`), wrapping a
 * subtree re-temperatures every component inside it without touching one of
 * them — and a parent screen can hold "cool structure, hot accents on
 * child-related cards" (doc 02 §5.3) by nesting one inside the other.
 *
 * The one dial property this CANNOT carry is border WIDTH: `border-2` compiles
 * to a literal, not a variable, so Hot's 2px vs Cool's 1px has to arrive with a
 * component's own variant. Colour, radius, shadow, density and duration all
 * cascade; width waits for the Wave-2 component pass. Documented rather than
 * faked, so nobody wonders why one row of the §5.3 table is missing.
 */
const dialScope = (temp) => {
  const out = [`  .dial-${temp} {`];
  out.push(`    --radius-card: var(--radius-${temp});`);
  out.push(`    --radius-sheet: var(--radius-${temp});`);
  out.push(`    --shadow-card: var(--shadow-${temp});`);
  out.push(`    --shadow-raised: var(--shadow-${temp});`);
  // Cool's hairline: 1px ink @ 80% (§5.3). Width still can't cascade.
  if (temp === 'cool') out.push('    --color-border: var(--color-border-soft);');
  out.push(`    --dial-row: var(--spacing-row-${temp});`);
  out.push(`    --dial-duration: var(--duration-${temp});`);
  // Ramp + tiers, generated from the same tokens that emitted the values above,
  // so a new ramp entry cannot be added to tokens.ts and silently not remap.
  for (const name of Object.keys(uiRamp)) {
    out.push(`    --text-${name}: var(--text-${name}-${temp});`);
    out.push(`    --text-${name}--line-height: var(--text-${name}-${temp}--line-height);`);
    out.push(`    --text-${name}--font-weight: var(--text-${name}-${temp}--font-weight);`);
  }
  for (const name of Object.keys(spacingTiers)) {
    out.push(`    --spacing-${name}: var(--spacing-${name}-${temp});`);
  }
  out.push('  }');
  return out;
};

/**
 * "Comfy reading" (doc 08 §3.3), opt-in per learner. Scoped like the dial so it
 * composes with it: `<Dial temperature="hot"><View className="reading-comfort">`.
 * Bumps body to body-lg, opens tracking and leading, and steps gap-stack up one
 * tier — the four changes the research asks for, in one class.
 */
const READING_COMFORT = `@layer base {
  .reading-comfort {
    --text-body: var(--text-body-lg);
    --text-body--line-height: ${readingComfort['line-height']};
    --text-body--letter-spacing: ${readingComfort['letter-spacing']};
    --spacing-stack: var(--spacing-group);
  }
}`;

const DIAL_SCOPES = ['@layer base {', ...dialScope('hot'), ...dialScope('cool'), '}'].join('\n');

/**
 * Role scopes (doc 36 §5): the shell wrapper re-points the ONE themed pair at
 * its door's hue, exactly as the dial re-points chrome — slot components write
 * `bg-role-accent(-underlay)` once and every shell colours them by nesting.
 * Generated from `accentRoles` so a new role cannot mint tokens and silently
 * miss its scope. No `.role-admin` exists: the back office has no accent, and
 * an unscoped tree resolves to the learner default declared in @theme.
 */
const roleScope = (role) => [
  `  .role-${role} {`,
  `    --color-role-accent: var(--color-role-${role});`,
  `    --color-role-accent-underlay: var(--color-role-${role}-underlay);`,
  '  }',
];
const ROLE_SCOPES = ['@layer base {', ...accentRoles.flatMap(roleScope), '}'].join('\n');

// React Native's `fontVariant` accepts tabular-nums but has NO slashed-zero
// equivalent, so native gets the alignment and not the slash. Do not "fix" this by
// adding slashed-zero here — it would be a style key the runtime silently drops.
const MONO_NUMERICS_NATIVE = `@layer base {
  .font-mono { font-variant-numeric: tabular-nums; }
}`;

// ---------------------------------------------------------------- web ------

const web = [HEADER, '@theme {'];
web.push(...sharedThemeTokens());
// semantic colors — light-dark() gives system-following for free
for (const [name, { light, dark }] of Object.entries(semantic)) {
  web.push(`  --color-${name}: light-dark(${light}, ${dark});`);
}
web.push('}');
web.push('');
web.push(':root {');
web.push('  color-scheme: light dark; /* system-following default; override via [data-theme] */');
web.push(...rootVars());
web.push('}');
web.push('');
web.push('/* user override (persisted): data-theme wins over system */');
web.push("[data-theme='light'] { color-scheme: light; }");
web.push("[data-theme='dark'] { color-scheme: dark; }");
web.push('');
web.push(BODY_TEXT_BASE);
web.push('');
web.push(MONO_NUMERICS_WEB);
web.push('');
web.push(DIAL_SCOPES);
web.push('');
web.push(ROLE_SCOPES);
web.push('');
web.push(READING_COMFORT);
web.push(`
/* @expo/ui BottomSheet (vaul) on web: the drawer hardcodes a white/black
   background and a non-flex inner wrapper, so the kit's SheetSurface can't
   fill or theme it. Stylesheet !important beats the inline styles. */
[data-vaul-drawer] {
  background-color: var(--color-surface-raised) !important;
}
[data-vaul-drawer] > div:last-child {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
`);

writeFileSync(new URL('./theme.css', import.meta.url), web.join('\n'));

// -------------------------------------------------------------- native -----

const native = [HEADER, '@theme {'];
native.push(...sharedThemeTokens());
native.push('}');
native.push('');
native.push(`/* Semantic colors. Uniwind resolves themes from these @variant blocks and
   registers the utilities (bg-surface, text-text, ...) from them too, so they
   are deliberately NOT duplicated into @theme above. Every variant must declare
   the IDENTICAL set of variables or Uniwind raises a runtime error. */`);
native.push('@layer theme {');
native.push('  :root {');
for (const variant of ['light', 'dark']) {
  native.push(`    @variant ${variant} {`);
  for (const [name, values] of Object.entries(semantic)) {
    native.push(`      --color-${name}: ${values[variant]};`);
  }
  native.push('    }');
}
native.push('  }');
native.push('}');
native.push('');
native.push(':root {');
native.push(...rootVars());
native.push('}');
native.push('');
native.push(BODY_TEXT_BASE);
native.push('');
native.push(MONO_NUMERICS_NATIVE);
native.push('');
native.push(DIAL_SCOPES);
native.push('');
native.push(ROLE_SCOPES);
native.push('');
native.push(READING_COMFORT);
native.push('');

writeFileSync(new URL('./theme-native.css', import.meta.url), native.join('\n'));

// --------------------------------------------------------- payload admin ----

/**
 * The Payload admin panel, themed by re-declaring PAYLOAD's own variables with
 * Moyo's values. Three things make this the only safe shape:
 *
 * 1. Payload 4 does NOT use the `--theme-elevation-*` / `--theme-bg` vocabulary
 *    that every 3.x guide describes. It uses a `--ramp-*` palette behind a
 *    `--color-bg|text|border|icon-*` semantic layer (UI3 naming), verified
 *    against node_modules/@payloadcms/ui/dist/css. A `--theme-*` override here
 *    would silently no-op.
 * 2. Payload's semantic names COLLIDE with ours: it owns `--color-text`,
 *    `--color-border` and `--color-border-strong` too, with different meanings.
 *    So theme.css must never be loaded into the admin document, and this file
 *    must never be loaded outside it. Values are inlined by this generator
 *    rather than referenced with var(), which is what keeps the two apart.
 * 3. Payload wraps its own rules in `@layer payload-default`, so a plain :root
 *    block already outranks them. No !important, ever — a rule that does not
 *    land has the wrong variable name, not a specificity problem.
 *
 * Overriding the semantic layer and not `--ramp-*` is deliberate: the ramp is
 * shared by things we do not want recoloured (multiplayer cursors, code syntax).
 */
const payloadAdmin = () => {
  const out = [];
  const s = (name, mode) => semantic[name][mode];

  for (const mode of ['light', 'dark']) {
    // Payload keys dark off the attribute, never the OS — its own theme toggle
    // writes it, so following prefers-color-scheme here would fight the switch.
    out.push(mode === 'light' ? ':root {' : "html[data-theme='dark'], [data-theme='dark'] {");

    out.push('  /* ground */');
    out.push(`  --color-bg: ${s('surface', mode)};`);
    out.push(`  --color-bg-hover: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-pressed: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-secondary: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-secondary-hover: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-secondary-pressed: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-tertiary: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-elevated: ${s('surface-raised', mode)};`);
    out.push(`  --color-bg-disabled: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-inverse: ${s('text', mode)};`);
    out.push(`  --color-bg-menu: ${s('surface-raised', mode)};`);
    out.push(`  --color-bg-tooltip: ${s('text', mode)};`);
    out.push(`  --color-text-ontooltip: ${s('text-inverse', mode)};`);

    out.push('  /* type + icons */');
    out.push(`  --color-text: ${s('text', mode)};`);
    out.push(`  --color-text-secondary: ${s('text-muted', mode)};`);
    out.push(`  --color-text-tertiary: ${s('text-muted', mode)};`);
    out.push(`  --color-text-disabled: ${s('text-muted', mode)};`);
    out.push(`  --color-text-oninverse: ${s('text-inverse', mode)};`);
    out.push(`  --color-icon: ${s('text', mode)};`);
    out.push(`  --color-icon-secondary: ${s('text-muted', mode)};`);
    out.push(`  --color-icon-tertiary: ${s('text-muted', mode)};`);
    out.push(`  --color-icon-disabled: ${s('text-muted', mode)};`);
    out.push(`  --color-icon-oninverse: ${s('text-inverse', mode)};`);

    /*
      Cool dial (doc 02 §5.3): the admin is an ops surface, so its hairline is
      ink at 80% rather than the full-strength frame the learner cards carry.
    */
    out.push('  /* structure — borders are structure, never emphasis */');
    out.push(`  --color-border: ${s('border-soft', mode)};`);
    out.push(`  --color-border-strong: ${s('border-strong', mode)};`);
    out.push(`  --color-border-disabled: ${s('border-faint', mode)};`);

    /*
      One accent. Payload's brand blue drives every primary button, so mapping
      the pair `bg-brand` + `text-onbrand` is what turns the whole admin's
      primary action into the kit's ink-on-yellow Button.
    */
    out.push('  /* brand — the single accent */');
    out.push(`  --color-bg-brand: ${s('primary', mode)};`);
    out.push(`  --color-bg-brand-hover: ${s('primary-pressed', mode)};`);
    out.push(`  --color-bg-brand-pressed: ${s('primary-pressed', mode)};`);
    out.push(`  --color-bg-brand-secondary: ${s('primary-pressed', mode)};`);
    out.push(`  --color-bg-brand-tertiary: ${s('surface-sunken', mode)};`);
    out.push(`  --color-bg-brand-tertiary-hover: ${s('surface-sunken', mode)};`);
    out.push(`  --color-text-onbrand: ${s('on-primary', mode)};`);
    out.push(`  --color-text-onbrand-secondary: ${s('on-primary', mode)};`);
    out.push(`  --color-icon-onbrand: ${s('on-primary', mode)};`);
    out.push(`  --color-icon-onbrand-secondary: ${s('on-primary', mode)};`);
    out.push(`  --color-border-brand-strong: ${s('border-strong', mode)};`);
    // Links are a MARK, not a surface: ballpoint clears AA on paper, the
    // yellow does not (1.34:1) and would be unreadable as text.
    out.push(`  --color-text-brand: ${s('ballpoint', mode)};`);
    out.push(`  --color-text-brand-secondary: ${s('ballpoint', mode)};`);
    out.push(`  --color-icon-brand: ${s('ballpoint', mode)};`);

    /*
      Selection = highlighter underlay with ink on top (14.4:1), doc 08 §4.6.
      `--color-border-selected` is also what `--accessibility-focus-color`
      resolves to, and a yellow ring on paper measures 1.34:1 — invisible. The
      focus ring is ink; only the FILL is ever highlighter.
    */
    out.push('  /* selection + focus */');
    out.push(`  --color-bg-selected: ${s('highlighter', mode)};`);
    out.push(`  --color-bg-selected-hover: ${s('highlighter', mode)};`);
    out.push(`  --color-bg-selected-pressed: ${s('highlighter', mode)};`);
    out.push(`  --color-bg-selected-strong: ${s('highlighter', mode)};`);
    out.push(`  --color-text-selected: ${s('on-highlighter', mode)};`);
    out.push(`  --color-text-onselected-strong: ${s('on-highlighter', mode)};`);
    out.push(`  --color-icon-selected: ${s('on-highlighter', mode)};`);
    out.push(`  --color-icon-onselected-strong: ${s('on-highlighter', mode)};`);
    out.push(`  --color-border-selected: ${s('border-strong', mode)};`);
    out.push(`  --color-border-selected-strong: ${s('border-strong', mode)};`);

    /*
      redpen is teacher feedback and danger is a system failure — they are two
      different jobs and tokens.ts keeps them apart. Payload's `danger` is a
      destructive action, so it gets `danger`; only validation TEXT gets redpen.
    */
    out.push('  /* status */');
    out.push(`  --color-bg-danger: ${s('danger', mode)};`);
    out.push(`  --color-bg-danger-hover: ${s('danger', mode)};`);
    out.push(`  --color-bg-danger-pressed: ${s('danger', mode)};`);
    out.push(`  --color-text-ondanger: ${s('on-danger', mode)};`);
    out.push(`  --color-icon-ondanger: ${s('on-danger', mode)};`);
    out.push(`  --color-text-danger: ${s('redpen', mode)};`);
    out.push(`  --color-icon-danger: ${s('redpen', mode)};`);
    out.push(`  --color-border-danger-strong: ${s('redpen', mode)};`);
    out.push(`  --color-bg-success: ${s('grade', mode)};`);
    out.push(`  --color-text-success: ${s('grade', mode)};`);
    out.push(`  --color-icon-success: ${s('grade', mode)};`);
    out.push(`  --color-border-success-strong: ${s('grade', mode)};`);
    out.push(`  --color-bg-warning: ${s('highlighter', mode)};`);
    out.push(`  --color-text-onwarning: ${s('on-highlighter', mode)};`);
    out.push(`  --color-text-warning: ${s('text', mode)};`);
    out.push(`  --color-border-warning-strong: ${s('border-strong', mode)};`);

    out.push('  /* fields */');
    out.push(`  --field-color-bg: ${s('surface', mode)};`);
    out.push(`  --field-color-bg-disabled: ${s('surface-sunken', mode)};`);
    out.push(`  --field-color-text: ${s('text', mode)};`);
    out.push(`  --field-color-text-disabled: ${s('text-muted', mode)};`);
    out.push(`  --field-color-placeholder: ${s('text-muted', mode)};`);
    out.push(`  --field-color-border: ${s('border-soft', mode)};`);
    out.push(`  --field-color-border-hover: ${s('border-strong', mode)};`);
    out.push(`  --field-color-border-focus: ${s('border-strong', mode)};`);
    out.push(`  --field-color-border-disabled: ${s('border-faint', mode)};`);
    out.push(`  --field-color-border-error: ${s('redpen', mode)};`);

    /*
      Hard offset slabs, no blur — the elevation language is a shadow that could
      be drawn with a marker. The colour has to be inlined: these are Payload's
      variables and cannot reference ours.
    */
    const slab = (offset, color) => `${offset}px ${offset}px 0 0 ${color}`;
    out.push('  /* elevation — slabs, never blur */');
    out.push(`  --elevation-100-canvas: ${slab(2, s('border-faint', mode))};`);
    out.push(`  --elevation-300-tooltip: ${slab(3, s('border-strong', mode))};`);
    out.push(`  --elevation-400-menu-panel: ${slab(4, s('border-strong', mode))};`);
    out.push(`  --elevation-500-modal-window: ${slab(6, s('border-strong', mode))};`);

    out.push(`  --scrollbar-color: ${palette.burgundy[600]};`);
    out.push('}');
    out.push('');
  }

  // Theme-independent: shape, type, and target size.
  out.push('/* Shape, type and target size — identical in both themes. */');
  out.push(':root {');
  out.push(`  --font-family-sans: ${fontFamilies.sans};`);
  out.push(`  --font-family-mono: ${fontFamilies.mono};`);
  // Payload has no display slot of its own — the brand lockup needs one.
  out.push(`  --font-family-display: ${fontFamilies.display};`);
  out.push(`  --radius-small: ${radius.xs};`);
  out.push(`  --radius-chip: ${radius.sm};`);
  out.push(`  --radius-medium: ${radius.control};`);
  out.push(`  --radius-large: ${dial.cool.radius};`);
  out.push(`  --field-border-radius: ${radius.control};`);
  out.push(`  --button-radius: ${radius.control};`);
  out.push(`  --popup-radius: ${dial.cool.radius};`);
  out.push(`  --popup-item-radius: ${radius.control};`);
  /*
    Payload ships 1px hairlines. 2px is the ink border this design language is
    built on, and because `--accessibility-outline` is composed from
    `--stroke-width-small`, the same line also gives every focusable element a
    2px ink focus ring — one variable, both jobs.
  */
  out.push('  --stroke-width-small: 2px;');
  out.push('  --stroke-width-medium: 2px;');
  out.push('  --accessibility-outline-offset: 2px;');
  /*
    Payload's stock controls are 24–32px, under the WCAG 2.2 target floor and
    well under the Cool dial's 44 (doc 08 §2.4). Raising the four size variables
    lifts every button, input and toolbar control in the admin at once.
  */
  out.push(`  --button-height: ${targets.adult};`);
  out.push(`  --control-height: ${targets.adult};`);
  out.push(`  --field-min-height-medium: ${targets.adult};`);
  out.push(`  --field-min-height-large: ${targets.teen};`);
  out.push(`  --field-padding-inline: ${spacingTiers['inset-tight'].cool};`);
  out.push('}');

  /*
    Payload's own ramp runs 9 / 11 / 13px, and 11px is its BODY size — every
    label, button and table cell in the panel. Doc 08 §3.1 puts the floor at 12
    and never below, so the stock scale fails the floor on the most common text
    in the product. Remapping its six steps onto the Cool ramp lifts the whole
    panel at once; the `-strong` cuts keep their size and step weight, which is
    how the ramp expresses emphasis.

    Letter-spacing goes to `normal`. Payload tracks sub-pixel per step (-0.25px,
    0.055px); our ramp does not track at all, and leaving a foreign tracking
    curve on our faces is a large part of why the panel read as someone else's
    product.
  */
  const RAMP = [
    ['body-small', 'caption', null],
    ['body-small-strong', 'caption', '600'],
    ['body-medium', 'label', null],
    ['body-medium-strong', 'label', '600'],
    ['body-large', 'body', null],
    ['body-large-strong', 'body', '600'],
    ['heading-small', 'label', '600'],
    ['heading-medium', 'title', null],
    ['heading-large', 'title-lg', null],
  ];
  out.push('');
  out.push('/* Type — Payload\'s 9/11/13 ramp remapped onto the Cool ramp (doc 08 §3.1). */');
  out.push(':root {');
  out.push('  --text-letter-spacing: normal;');
  for (const [payloadStep, moyoStep, weightOverride] of RAMP) {
    const [size, lineHeight, weight] = uiRamp[moyoStep].cool;
    out.push(`  --text-${payloadStep}-font-family: var(--font-family-sans);`);
    out.push(`  --text-${payloadStep}-font-size: ${size};`);
    out.push(`  --text-${payloadStep}-font-weight: ${weightOverride ?? weight};`);
    out.push(`  --text-${payloadStep}-line-height: ${lineHeight};`);
    out.push(`  --text-${payloadStep}-letter-spacing: normal;`);
  }
  out.push('}');

  return out;
};

const admin = [
  HEADER,
  '/* Payload 4 admin theme. Loaded ONLY from apps/web/app/(payload)/custom.css.',
  '   Never import theme.css into the same document — Payload owns --color-text,',
  '   --color-border and --color-border-strong under different meanings. */',
  '',
  ...payloadAdmin(),
  '',
];

writeFileSync(new URL('./payload-admin.css', import.meta.url), admin.join('\n'));

console.log('theme.css + theme-native.css + payload-admin.css written');
