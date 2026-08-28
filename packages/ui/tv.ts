// The kit's configured `tailwind-variants`. EVERY component imports `tv` from
// here, never from 'tailwind-variants' directly.
//
// Why this file exists: tailwind-merge decides what a `text-*` class means by
// pattern, and it only recognises its own size scale (xs…9xl). Our ramp tokens
// — `text-title-lg`, `text-caption`, `text-data`, `text-display-sm` — match none
// of them, so it classified every one as a text COLOUR. A slot written as
// `text-caption text-text-muted` therefore looked like two colours in conflict,
// and the merger silently deleted one of them.
//
// The failure was invisible in review and everywhere in the product: labels fell
// back to inherited 14px instead of the 12–13px ramp, and StatCard's number lost
// `text-text` and rendered near-black on a dark card. `check-utilities.mjs`
// cannot catch it — the token exists and the utility is generated; the class is
// dropped afterwards, at merge time.
// SOT: packages/theme/tokens.ts `uiRamp` + `typeScale`
// SOT-KEYWORDS: tailwind variants merge config font-size ramp tv slots classgroup
import { createTV } from 'tailwind-variants';

/**
 * Keep in step with `uiRamp`, `typeScale` and `siteTypeScale` in tokens.ts.
 * `check-utilities.mjs` asserts the same names generate a utility; this asserts
 * they survive merging.
 *
 * The `site-*` steps are the marketing site's fluid ramp. They are listed here
 * even though the site does not render through `tv()` today, because the trap is
 * the merger's, not the kit's: `apps/web-vite` composes kit components whose own
 * slots run through this config, so a site class landing on a kit element hits
 * exactly the same classification. Registering them costs one line each and
 * removes a bug that is invisible in review.
 */
export const RAMP_FONT_SIZES = [
  'title-lg',
  'title',
  'body-lg',
  'body',
  'label',
  'caption',
  'data',
  'data-lg',
  'display-2xl',
  'display-xl',
  'display-lg',
  'display-md',
  'display-sm',
  'site-hero',
  'site-chapter',
  'site-title',
  'site-subtitle',
  'site-lead',
  'site-body',
  'site-label',
  'site-quote',
  'site-note',
] as const;

export const tv = createTV({
  twMergeConfig: {
    extend: {
      classGroups: {
        'font-size': [{ text: [...RAMP_FONT_SIZES] }],
      },
    },
  },
});

export type { VariantProps } from 'tailwind-variants';
