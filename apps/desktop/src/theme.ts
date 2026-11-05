/**
 * Desktop token adapter: reads `@acme/theme` tokens and returns React Native
 * numbers and colors for the Spark window.
 *
 * Why it exists: `packages/theme/tokens.ts` stores lengths as CSS strings
 * ("0.75rem", "44px") for the web build. React Native style props take numbers,
 * so the desktop shell converts them here once instead of inlining raw values.
 * The rem base is 16 on purpose. Mobile's Metro sets `polyfills.rem = 14`
 * (see the `targets` comment in tokens.ts); desktop has no such polyfill, so
 * 16 is what the web build and the token comments assume.
 *
 * The import is a relative path rather than `@acme/theme` because apps/desktop
 * is outside the root pnpm workspace and has its own npm graph; a `file:` link
 * would make npm parse the theme package's `workspace:*` and `catalog:` specs.
 * tokens.ts has no imports, so only that one file crosses the boundary.
 * SOT: packages/theme/tokens.ts · docs/desktop/seams/SEAMS.md
 * SOT-KEYWORDS: desktop theme tokens adapter rem color scheme spark
 */
import { useColorScheme } from "react-native";
import {
  radius,
  semantic,
  spacingTiers,
  targets,
  uiRamp,
} from "../../../packages/theme/tokens";

const REM_PX = 16;

type CssLength = `${number}rem` | `${number}px`;

/** Converts a token length ("0.75rem" or "44px") to React Native points. */
export function toPoints(value: CssLength): number {
  if (value.endsWith("rem")) return Number.parseFloat(value) * REM_PX;
  return Number.parseFloat(value);
}

type SemanticName = keyof typeof semantic;
export type Scheme = "light" | "dark";

/** Resolves a semantic color for the active macOS appearance. */
export function color(name: SemanticName, scheme: Scheme): string {
  return semantic[name][scheme];
}

/**
 * Desktop surfaces use the `cool` dial: the window is an adult tool (tutor,
 * guardian, operator), and the hot dial is reserved for learner screens with
 * age-band targets, which this shell does not render.
 */
export const space = {
  hair: toPoints(spacingTiers["inset-hair"].cool),
  tight: toPoints(spacingTiers["inset-tight"].cool),
  inset: toPoints(spacingTiers.inset.cool),
  roomy: toPoints(spacingTiers["inset-roomy"].cool),
  element: toPoints(spacingTiers.element.cool),
  stack: toPoints(spacingTiers.stack.cool),
  group: toPoints(spacingTiers.group.cool),
  section: toPoints(spacingTiers.section.cool),
} as const;

export const corner = {
  control: toPoints(radius.control),
  card: toPoints(radius.card),
  sheet: toPoints(radius.sheet),
} as const;

/** Adult band: Apple HIG 44pt. The desktop shell has no learner surface yet. */
export const target = toPoints(targets.adult);

type RampStep = keyof typeof uiRamp;
type FontWeight = "400" | "500" | "600" | "700";

/** One `uiRamp` step on the cool dial as React Native text style values. */
export function textStyle(step: RampStep): {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
} {
  const [size, leading, weight] = uiRamp[step].cool;
  const fontSize = toPoints(size);
  return {
    fontSize,
    lineHeight: Math.round(fontSize * Number.parseFloat(leading)),
    fontWeight: weight,
  };
}

/** Follows the macOS appearance; Spark reports it through RN `Appearance`. */
export function useScheme(): Scheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}
