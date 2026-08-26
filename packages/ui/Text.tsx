import { tv, type VariantProps } from './tv';
import { Text as TWText } from './primitives';

/**
 * The type scale steps up with the window AND dials with the surface.
 *
 * Two independent axes, which is why this looked wrong for so long:
 *
 *  - Viewport. A phone-tuned scale on a 1280dp tablet reads as fine print — the
 *    same body size sits in three times the measure. Hence `md:`, at 768dp, the
 *    kit's REGULAR_MIN_WIDTH, where a layout stops being phone-shaped.
 *  - Surface. `uiRamp` carries a Cool value for ops and educator chrome and a
 *    Hot one for learner and family screens, so the same `text-body` is 15px in
 *    a dashboard and 17px in front of a child. `<Dial>` re-points the token; the
 *    component never asks which it is in.
 *
 * The ramp tokens carry size, line-height AND weight, so a variant that names
 * one must not also hand-write a weight — it would win over the dial.
 *
 * `body`, `caption`, `label` and `data` are the ramp's own names and use it.
 * `display`, `title` and `heading` stay on the display scale, which has no ramp
 * counterpart and is a headline concern rather than a UI one.
 *
 * Why this changed: these variants used raw Tailwind (`text-base md:text-lg`)
 * while 224 call sites hand-wrote `text-caption`, `text-body`, `text-label` and
 * `text-data` to reach the dial the component could not express — against 89
 * using the variants. The codebase had already voted; the component was the
 * minority pattern. The ramp's own comment says it exists because "Button and
 * friends were falling back to Tailwind's raw text-sm/base/lg", and this is the
 * component that most needed it.
 */
const text = tv({
  base: 'font-sans text-text',
  variants: {
    variant: {
      display: 'font-display text-display-md md:text-display-lg',
      title: 'font-display text-2xl font-semibold md:text-3xl',
      heading: 'text-lg font-semibold md:text-xl lg:text-2xl',
      body: 'text-body md:text-body-lg',
      // The floor. `uiRamp` says never below 12 and never for anything a user
      // must act on, so it does not step up — a floor that grows is not one.
      caption: 'text-caption',
      // No weight here: `text-label` carries 500 Cool / 600 Hot itself.
      label: 'text-label uppercase tracking-wide',
      // The mono ramp — every time, price, %, and count, so columns align.
      data: 'font-mono text-data md:text-data-lg',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      accent: 'text-accent',
      primary: 'text-primary',
      inverse: 'text-text-inverse',
      danger: 'text-danger',
    },
  },
  defaultVariants: { variant: 'body', tone: 'default' },
});

export interface TextProps
  extends React.ComponentProps<typeof TWText>,
    VariantProps<typeof text> {}

export function Text({ variant, tone, className, ...props }: TextProps) {
  return <TWText className={text({ variant, tone, className })} {...props} />;
}
