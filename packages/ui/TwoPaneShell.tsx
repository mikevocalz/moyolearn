'use client';
// The auth/marketing split: a brand pane beside the form on wide screens, and a
// compact brand BAND above the form on narrow ones.
//
// It exists because the sign-in screen has two jobs that want opposite shapes —
// "you are in the right place" (a brand, which wants room) and "type two
// fields" (a form, which wants focus). Side by side they cooperate; stacked on
// a phone they compete, so the brand shrinks to one band and yields.
//
// LAYOUT, NOT NAVIGATION (doc 37 §3.1). No AdaptivePanes, no SplitView, no
// router: there is one screen here at every width, and the two panes are two
// boxes in one flex container. The pane navigator would buy a back stack, a
// selection store and a detail slot for a surface that has none of the three.
//
// Mobbin: https://mobbin.com/screens/469d5c13-2c01-4042-a30a-9eb89a093bd6 (Remote — brand panel beside the form carrying a mark and a single promise line) · https://mobbin.com/screens/c1d730e1-1e71-4354-abe1-7c8ec94dc1e0 (Neon — the pane is a mark plus ONE tagline line, which is exactly the part that has to survive the collapse) · https://mobbin.com/screens/85a6b45d-b5f9-491e-a5c9-81e40b71b8d8 (Magnific — full-bleed imagery pane against a fixed form column) · https://mobbin.com/screens/81adcbf8-3266-49bb-9418-ef99dde7be42 (7shifts — form column capped, the brand side takes the flexible remainder) · https://mobbin.com/screens/9d3673ca-9887-4bbf-9316-0c4eb9b59a43 (Goodreads — the collapsed state: a wordmark band above the form that scrolls with the content) · https://mobbin.com/screens/fcb1f3d7-06df-41f4-8287-588ea024a99c (Rocket Money — compact band is mark + one line, form immediately under it)
// SOT: docs/pack/37-onboarding-dual-pane.md §3.1 · docs/design/pane-audit-37.md §A.1 §C
// SOT-KEYWORDS: two pane shell auth login signin brand pane band collapse split layout keyboard marketing
import { tv } from './tv';
import { View } from './primitives';
import { Main } from './html';
import { Text } from './Text';
import { Image } from './Image';
import { BrandLockup } from './BrandLockup';
import { Container } from './layout/Container';
import { SafeArea } from './SafeArea';
import { KeyboardAwareScroll } from './keyboard-aware';

/**
 * The brand pane's content — data, never nodes.
 *
 * DOC 37's HARD RULE MADE UNREPRESENTABLE: "the brand pane contains zero
 * interactive content, so collapsing it can never orphan a control." A
 * `ReactNode` slot could not promise that; a caller would eventually drop a
 * "Learn more" link in, the band would swallow it at 767px, and the control
 * would be gone with no error anywhere. So the pane takes no nodes at all —
 * strings and an image source — and there is no shape of this type that
 * contains something pressable. `children` reaches only the FORM pane, which is
 * the one pane that never collapses.
 */
export interface TwoPaneBrandOrg {
  name: string;
  /** A district's mark. Name and URL travel together — `BrandLockup` shows a partner only when it has both. */
  logoUrl: string;
  /** A wordmark gets a 4:3 box; a seal stays square. Passed straight to `BrandLockup`. */
  logoAspect?: 'square' | 'wide';
}

/** One value, so an image with no alt text cannot be expressed. */
export interface TwoPaneBrandImage {
  src: string;
  alt: string;
}

export interface TwoPaneBrand {
  /** The one line that survives the collapse. Doc 37: the band is logo + ONE tagline line. */
  tagline: string;
  /** Pane-only. Dropped in the band by design — a second line is what makes a band a screen. */
  supporting?: string;
  /** The partner district, on a co-branded route. */
  org?: TwoPaneBrandOrg;
  /** Pane-only imagery (doc 37 §3.1's "photography / Natalie still"). */
  image?: TwoPaneBrandImage;
}

export interface TwoPaneShellProps {
  brand: TwoPaneBrand;
  /**
   * The form pane. The ONLY slot that accepts nodes, and therefore the only
   * place in this shell a control can exist.
   */
  children: React.ReactNode;
  className?: string;
}

/*
  WIDTH CLASS — which of the repo's two systems, and why.

  `packages/ui/size-class.constants.ts` (`compact | regular` at 768) is the one
  this screen belongs to: the question is one column or two, which is exactly
  what that binary answers. `widthClassMinDp` in packages/theme/tokens.ts
  (compact/medium/expanded/large) is the Material dp scale that drives
  MULTI-pane policy in `adaptive-panes`, and its own comment says not to merge
  the two by nudging numbers. There is no third system here.

  But the boundary is read in CSS (`md:`), not through `useSizeClass()`. This is
  a server-rendered auth page, and the web fork of that hook resolves the server
  snapshot to `regular` on purpose — so a phone would receive two-pane HTML and
  swap to the band after hydration, a visible flash on the one screen whose
  whole job is "you are in the right place". The hook's own docblock routes this
  case to CSS for that reason. `md` is 48rem (`breakpoints.md`), which is 768 —
  the same number as `REGULAR_MIN_WIDTH`, expressed in the medium that needs no
  viewport guess. `Text.tsx` already steps its ramp at `md:` on that basis.
*/
const shell = tv({
  slots: {
    root: 'w-full flex-1 bg-surface',
    safe: 'flex-1',
    scroll: 'flex-1',
    /*
      ONE tree, not two. The brand element is never duplicated and never
      hidden — it is the first child of a container that turns from a column
      into a row at `md`, so "band above the form" and "pane beside the form"
      are the same two boxes read in the two directions. A hidden-pane /
      visible-band pair would have fetched the district's logo twice and let
      the two copies drift apart on the next edit.

      It also sits INSIDE the scroll view, which is how doc 37's keyboard law
      is met literally: keyboard avoidance owns the form pane, and because the
      band is scrollable content ABOVE the fields, a raised keyboard pushes the
      band off the top first. The band yields; the form stays reachable.
    */
    content: 'grow md:flex-row',
    /*
      No `w-full` on either pane, deliberately. The container stretches its
      children on the cross axis already, so `w-full` is a no-op in the column
      and a bug in the row: `width: 100%` becomes 100% of the WHOLE row, so the
      form pane started at the 40% mark and ran a viewport-width off the right
      edge. The panes state their main-axis size only — 2/5 and "the rest".
    */
    brand:
      'shrink-0 items-center gap-element border-b-2 border-border bg-surface-sunken p-inset ' +
      'md:w-2/5 md:items-start md:justify-center md:gap-group md:border-b-0 md:border-r-2 md:p-section',
    /*
      One element, two presentations — chrome in the band, brand line in the
      pane. It stops at `title-lg` on purpose: the FORM's heading is the page's
      one display moment (it is also the h1, and the thing the visitor came to
      do), so a display-sized tagline beside it would be two headlines arguing.
      The `md:` step is explicit because `Text`'s default variant carries its
      own `md:` size — an unprefixed override alone leaves that one standing
      and the line silently shrinks above 768.
    */
    tagline: 'font-display text-center text-label md:text-left md:text-title-lg',
    supporting: 'hidden md:flex',
    // A still frame, not a banner: `aspect-square` keeps a portrait crop
    // portrait-shaped as the column widens.
    image: 'hidden w-full md:flex md:aspect-square md:rounded-card md:border-2 md:border-border',
    form: 'grow items-center justify-center p-inset md:p-section',
    formInner: 'gap-section',
  },
});

export function TwoPaneShell({ brand, children, className }: TwoPaneShellProps) {
  const s = shell();
  const { tagline, supporting, org, image } = brand;

  return (
    <Main className={s.root({ className })}>
      <SafeArea className={s.safe()}>
        <KeyboardAwareScroll className={s.scroll()} contentContainerClassName={s.content()}>
          <View className={s.brand()}>
            {/*
              `marks` and not `full`: the wordmark under the tile would repeat
              the district name the tagline and the form heading already carry,
              three times in one column.
            */}
            <BrandLockup
              size="lg"
              orgName={org?.name}
              orgLogoUrl={org?.logoUrl}
              orgLogoAspect={org?.logoAspect}
              variant="marks"
            />
            <Text className={s.tagline()}>{tagline}</Text>
            {supporting ? (
              <Text tone="muted" className={s.supporting()}>
                {supporting}
              </Text>
            ) : null}
            {image ? (
              // `unoptimized` for the same reason BrandLockup uses it: brand
              // media is uploaded per district, so its host is not in
              // next.config's remotePatterns and the optimizer would reject it.
              <Image className={s.image()} src={image.src} alt={image.alt} unoptimized />
            ) : null}
          </View>

          <View className={s.form()}>
            <Container width="form" className={s.formInner()}>
              {children}
            </Container>
          </View>
        </KeyboardAwareScroll>
      </SafeArea>
    </Main>
  );
}
