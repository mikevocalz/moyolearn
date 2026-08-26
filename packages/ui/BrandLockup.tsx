import { tv, type VariantProps } from './tv';
import { View, Text } from './primitives';
import { Image } from './Image';

/*
  The Moyo mark, optionally locked up with a partner's.

  The `M` tile was hand-inlined in six places before this — the Payload admin
  logo, the site header, the site footer, the ops sidebar, a Storybook duplicate
  — which is five chances for the brand to drift a border width at a time.

  CO-BRANDING RULE: the two marks carry the SAME VISUAL WEIGHT. A district that
  has put this product in front of its families is a partner, and a partner's
  logo shrunk to two-thirds reads as a footnote — the exact impression co-branding
  exists to avoid. The separator is a real multiplication sign rather than a
  lowercase x, which at 8px looks like a typo.

  Equal weight is not equal WIDTH, though. District logos are usually wordmarks —
  a seal beside a name, or a name alone — so a `wide` partner gets a 4:3 box and
  the image letterboxes inside it (`contentFit="contain"`). Cropping a district's
  wordmark to a square to match Moyo's tile is how a partner's brand ends up
  unreadable inside its own product. Both boxes are the same HEIGHT, which is
  what the eye reads as parity in a horizontal lockup.
*/
const lockup = tv({
  slots: {
    root: 'flex-row items-center gap-element',
    tile: 'items-center justify-center rounded-control border-2 border-border-strong bg-primary',
    letter: 'font-display text-on-primary',
    partner: 'rounded-control border-2 border-border-strong',
    word: 'font-display text-text',
    org: 'text-caption text-text-muted',
    times: 'text-text-muted',
  },
  variants: {
    size: {
      sm: {
        tile: 'h-8 w-8',
        letter: 'text-label',
        partner: 'h-8 w-8',
        word: 'text-title',
        times: 'text-caption',
      },
      lg: {
        tile: 'h-14 w-14',
        letter: 'text-title',
        partner: 'h-14 w-14',
        word: 'text-display-sm',
        times: 'text-label',
      },
    },
    /*
      4:3 comes from the standard spacing scale rather than an arbitrary
      `aspect-[4/3]`: 32×24 and 64×48 are both exactly 4:3 and both are real
      tokens, so no raw value enters the stylesheet (CLAUDE.md · UI).
    */
    wide: { true: {} },
  },
  compoundVariants: [
    { size: 'sm', wide: true, class: { partner: 'h-6 w-8' } },
    { size: 'lg', wide: true, class: { partner: 'h-12 w-16' } },
  ],
  defaultVariants: { size: 'sm' },
});

export interface BrandLockupProps extends Omit<VariantProps<typeof lockup>, 'wide'> {
  /** The partner district's name. Omit for Moyo's own surfaces. */
  orgName?: string;
  orgLogoUrl?: string;
  /** A wordmark gets a 4:3 box and letterboxes; a seal stays square. */
  orgLogoAspect?: 'square' | 'wide';
  /**
   * `marks` drops the "Moyo" wordmark but keeps both marks.
   *
   * `partner` shows the district's mark ALONE — for the collapsed rail, which is
   * 32px wide and cannot fit two marks and a separator. Dropping Moyo's is the
   * right half to lose there: a district employee knows whose software this is,
   * and what they need at that width is which district they are looking at.
   */
  variant?: 'full' | 'marks' | 'partner';
  className?: string;
}

export function BrandLockup({
  orgName,
  orgLogoUrl,
  orgLogoAspect,
  variant = 'full',
  size,
  className,
}: BrandLockupProps) {
  const s = lockup({ size, wide: orgLogoAspect === 'wide' });
  const partnered = Boolean(orgName && orgLogoUrl);

  // Falls back to Moyo's own mark when there is no partner, so the rail is never
  // empty on an unbranded org.
  if (variant === 'partner') {
    return partnered ? (
      <Image
        src={orgLogoUrl!}
        alt={`${orgName} logo`}
        className={s.partner({ className })}
        contentFit="contain"
        unoptimized
      />
    ) : (
      <View className={s.tile({ className })}>
        <Text className={s.letter()}>M</Text>
      </View>
    );
  }
  return (
    <View className={s.root({ className })}>
      <View className={s.tile()}>
        <Text className={s.letter()}>M</Text>
      </View>
      {partnered ? (
        <>
          {/* aria-hidden: a screen reader announcing "times" between two brand
              names reads as arithmetic. The names carry the relationship. */}
          <Text className={s.times()} aria-hidden>
            {'×'}
          </Text>
          <Image
            src={orgLogoUrl!}
            alt={`${orgName} logo`}
            className={s.partner()}
            contentFit="contain"
            unoptimized
          />
        </>
      ) : null}
      {variant === 'marks' ? null : (
        <View className="gap-0">
          <Text className={s.word()}>Moyo</Text>
          {orgName ? <Text className={s.org()}>{orgName}</Text> : null}
        </View>
      )}
    </View>
  );
}
