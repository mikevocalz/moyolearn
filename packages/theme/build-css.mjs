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
    out.push(`  --spacing-inset-${temp}: ${props.inset};`);
    out.push(`  --spacing-inset-roomy-${temp}: ${props['inset-roomy']};`);
    out.push(`  --spacing-row-${temp}: ${props['row-height']};`);
    out.push(`  --duration-${temp}: ${props.duration};`);
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
const DIAL_SCOPES = `@layer base {
  .dial-hot {
    --radius-card: var(--radius-hot);
    --radius-sheet: var(--radius-hot);
    --shadow-card: var(--shadow-hot);
    --shadow-raised: var(--shadow-hot);
    --dial-inset: var(--spacing-inset-hot);
    --dial-inset-roomy: var(--spacing-inset-roomy-hot);
    --dial-row: var(--spacing-row-hot);
    --dial-duration: var(--duration-hot);
  }
  .dial-cool {
    --radius-card: var(--radius-cool);
    --radius-sheet: var(--radius-cool);
    --shadow-card: var(--shadow-cool);
    --shadow-raised: var(--shadow-cool);
    --color-border: var(--color-border-soft);
    --dial-inset: var(--spacing-inset-cool);
    --dial-inset-roomy: var(--spacing-inset-roomy-cool);
    --dial-row: var(--spacing-row-cool);
    --dial-duration: var(--duration-cool);
  }
}`;

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

writeFileSync(new URL('./theme-native.css', import.meta.url), native.join('\n'));

console.log('theme.css + theme-native.css written');
