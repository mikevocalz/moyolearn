/**
 * Reads Moyo colour tokens out of the live stylesheet.
 *
 * The globe cannot use a Tailwind class — WebGL wants a number, not a
 * `className` — and the alternative everyone reaches for is a hex literal in
 * the scene file, which is precisely what `CLAUDE.md` bans and what
 * `docs/site/tokens.md` exists to prevent. So the scene resolves
 * `--color-moyo-sun` from the `.moyo-site` scope at material-build time and
 * hands three the value the stylesheet is already using. Change
 * `packages/theme/tokens.ts` and the globe changes with it; there is no second
 * copy of the palette to drift.
 *
 * The build-time pipeline participates: it emits a token NAME per region
 * (`fillToken: 'moyoSun'`), never a colour. `GlobeFillToken` in the generated
 * manifest is a subset of `MoyoSceneToken` below, and TypeScript enforces that
 * every time `colors[slice.fillToken]` is written — a region whose token is not
 * read here fails the build instead of rendering black.
 *
 * SOT: packages/theme/tokens.ts · packages/theme/theme.css (`.moyo-site`)
 *      docs/site/tokens.md §5.1
 * SOT-KEYWORDS: globe theme tokens css custom property colour resolve moyo three
 */

/**
 * Every token the globe composition touches, across all three tiers.
 *
 * A closed list rather than `Record<string, string>`, because
 * `noUncheckedIndexedAccess` would otherwise make each lookup `string |
 * undefined` and the honest fix for that is a fallback hex — a second palette,
 * in the one file that exists to not have one.
 */
export const MOYO_SCENE_TOKENS = [
  'moyoPrimary',
  'moyoOutline',
  'moyoSecondary',
  'moyoInk',
  'moyoSun',
  'moyoEarth',
  'moyoLeaf',
  'moyoPaperSunken',
  // The identity pair — the Moyo mark's own teal and plum. See tokens.ts.
  'moyoMark',
  'moyoMarkDeep',
  // Asia is separated from the Eurasian green so Russia keeps its green while
  // the rest of Asia can carry a teal.
  'moyoAsia',
] as const;

export type MoyoSceneToken = (typeof MOYO_SCENE_TOKENS)[number];
export type MoyoColors = Readonly<Record<MoyoSceneToken, string>>;

/**
 * `moyoSun` → `--color-moyo-sun`. The same camel→kebab conversion
 * `packages/theme/build-css.mjs` does with its `kebab()` helper; done here
 * rather than storing kebab names in the manifest so both halves of the
 * pipeline speak the §5.1 names.
 */
export function moyoCustomProperty(token: string): string {
  return `--color-${token.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * Every colour the scene needs, read in one pass.
 *
 * Read from `document.body` and not from the canvas's own parent: `.moyo-site`
 * is carried on `<body>` (`src/routes/__root.tsx`), and a canvas later portalled
 * elsewhere would resolve the product's dark-mode values instead. One element,
 * one answer, wherever the island mounts.
 */
export function readSceneColors(): MoyoColors {
  const stage = document.querySelector('.moyo-globe-stage') ?? document.body;
  const style = getComputedStyle(stage);
  const out = {} as Record<MoyoSceneToken, string>;
  for (const token of MOYO_SCENE_TOKENS) {
    out[token] = style.getPropertyValue(moyoCustomProperty(token)).trim();
  }
  return out;
}

/** A single numeric custom property, e.g. `--moyo-grain-opacity`. */
export function readMoyoNumber(property: string, fallback: number): number {
  const stage = document.querySelector('.moyo-globe-stage') ?? document.body;
  const raw = getComputedStyle(stage).getPropertyValue(property).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}
