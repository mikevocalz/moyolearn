import { tv, type VariantProps } from './tv';
import { View, Text } from './primitives';
import { Image } from './Image';
import MoyoMark from './MoyoMark';

/*
  The Moyo mark, optionally locked up with a partner's.

  The `M` tile was hand-inlined in six places before this — the Payload admin
  logo, the site header, the site footer, the ops sidebar, a Storybook duplicate
  — which is five chances for the brand to drift a border width at a time.

  THE TILE IS THE REAL MARK NOW. It used to be a purple square with the letter
  "M" set in the display face — a stand-in nobody replaced, so every surface
  that reached for "the Moyo logo" got a monogram the brand does not own. The
  actual compact mark ships at apps/mobile/assets/images/favicon.png and is
  drawn by `MoyoMark`. The square around it survives because the partner's logo
  gets one too, and two marks in matching boxes is what reads as a pairing; its
  fill went from `bg-primary` to a paper surface because the mark's own stem is
  that same purple and it disappeared into the tile.

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
// Mobbin: https://mobbin.com/screens/cb9fafea-3310-4ffa-86d4-6b8c2a39e87e (Expensify — partner brand gets its own territory, not a shrunken header slot) · https://mobbin.com/screens/aa905e20-651b-4ad3-85b7-5f256c90e266 (Deputy — brand panel carries equal weight beside the form) · https://mobbin.com/screens/a06d16a0-8f95-4502-a9c3-c2b70636ad1f (Teachable — org name as chrome above a neutral form; the version to beat, since the name gets lost) · https://mobbin.com/screens/213841a9-5eea-4ddb-a12a-d03aab7760e6 (Optimal Workshop — mark plus "Welcome back to X" naming the org in the heading) · https://mobbin.com/screens/6016e708-16a6-4ce3-a87c-5cee9bc3d3d6 (SchoolAI — districts need a find-your-district state, which is why an unknown slug degrades rather than 404s)
// SOT: docs/pack/09-screens-first-build-order.md §7
// SOT-KEYWORDS: brand lockup co-branding district logo mark wordmark partner login sidebar
const lockup = tv({
  slots: {
    root: 'flex-row items-center gap-element',
    tile: 'items-center justify-center rounded-control border-2 border-border-strong bg-surface',
    partner: 'rounded-control border-2 border-border-strong',
    word: 'font-display text-text',
    org: 'text-caption text-text-muted',
    times: 'text-text-muted',
  },
  variants: {
    size: {
      /*
        THE HEIGHTS MATCH, and the sizes are picked so that they can.

        Both marks must be the same height — that is what the eye reads as two
        partners rather than a brand and its subtitle. A 4:3 box at the same
        height as a 36px square needs to be 48px wide, and at 48px tall needs to
        be 64px: every one of those is a real step on the spacing scale, so the
        parity costs no arbitrary value. Heights of 32 and 56 were tried first
        and neither has a 4:3 partner on the scale, which is how the wordmark
        ended up shorter than the tile beside it.
      */
      sm: {
        tile: 'h-9 w-9',
        partner: 'h-9 w-9',
        word: 'text-title',
        times: 'text-caption',
      },
      lg: {
        tile: 'h-12 w-12',
        partner: 'h-12 w-12',
        word: 'text-display-sm',
        times: 'text-label',
      },
    },
    wide: { true: {} },
  },
  compoundVariants: [
    // 36×48 and 48×64 — exactly 4:3, exactly as tall as the square beside them.
    { size: 'sm', wide: true, class: { partner: 'h-9 w-12' } },
    { size: 'lg', wide: true, class: { partner: 'h-12 w-16' } },
  ],
  defaultVariants: { size: 'sm' },
});

/*
  The mark is a hair wider than it is tall (171×158), so it is sized by WIDTH
  inside the square tile — sizing by height would push it out past the left and
  right borders. 30 and 40 sit inside the 36 and 48 tiles once the 2px border
  pair is taken off both, with a pixel of air left over.
*/
const MARK_WIDTH = { sm: 30, lg: 40 } as const;

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
  const markWidth = MARK_WIDTH[size ?? 'sm'];

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
        <MoyoMark width={markWidth} accessibilityLabel="Moyo" />
      </View>
    );
  }
  return (
    <View className={s.root({ className })}>
      <View className={s.tile()}>
        {/* `marks` drops the "Moyo" wordmark below, so there the mark is the
            only thing naming the brand; with the wordmark present it is
            decorative, and labelling both says the name twice. */}
        <MoyoMark
          width={markWidth}
          aria-hidden={variant !== 'marks'}
          accessibilityLabel={variant === 'marks' ? 'Moyo' : undefined}
        />
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
