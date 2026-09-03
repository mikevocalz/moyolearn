'use client';
// NavDrawerButton — the ONE hamburger/close pair for every shell that has a
// drawer. Hamburger rides the header, close rides the drawer, and both are this
// component so the two controls cannot drift apart per tenant.
//
// It exists because they already had. The Cool shell (DashboardShell, worn by
// org/school/district/teacher/tutor/business) drew a 44px `rounded-control`
// hamburger with a 2px hairline border and no close control at all, while the
// Hot shell (learner/guardian, apps/web RoleShell) drew a 40px `rounded-full`
// tinted circle with a larger glyph — a different shape, size and weight for
// the same job, in the same product, one route apart. The circle was also the
// only pill-shaped chrome in the kit, which doc 02 §A.5 bans outright.
//
// WHY A CLOSE BUTTON AT ALL, given the scrim: Material 3's navigation drawer
// spec genuinely does not require one — it dismisses on scrim tap, edge swipe,
// system back, or destination select — but Material's own dismissal set leans
// on a hardware back key this product cannot assume, and two of its four routes
// are gestures with no visible affordance. Apple is the binding rule here: HIG
// Modality defines a modal as something that "requires an explicit action to
// dismiss" and asks for an obvious way to do it, and an X is HIG's named
// treatment for a modal that takes no input — which a nav drawer does not. The
// scrim is not inaccessible (measured: it is a labelled button and sits in the
// tab order), it is INVISIBLE — a sighted first-time user has to infer that the
// dimmed page is a control. So the scrim STAYS and this is what makes the exit
// something you can see. It is also now the first keyboard stop inside every
// drawer in the product, which the scrim previously occupied with no glyph.
//
// SOT: docs/pack/02-adaptive-screens-design-spec.md §5.3 §A.5 · docs/pack/08-visual-hierarchy-spacing-spec.md §2
// SOT-KEYWORDS: nav drawer hamburger close menu button shell chrome overlay dismiss
// Platform specs: Apple HIG Modality — a modal "requires an explicit action to
//   dismiss" (developer.apple.com/design/human-interface-guidelines/modality) ·
//   Material 3 navigation drawer, modal variant + scrim
//   (m3.material.io/components/navigation-drawer/guidelines)
// Mobbin: https://mobbin.com/screens/85d854a7-ef37-4aca-9850-413f7959edde (Beli —
//   drawer owns a header row, close pinned to its trailing edge) ·
//   https://mobbin.com/screens/155a6fa5-52e6-466e-b3b3-6333eb747dd6 (Hootsuite —
//   overlay drawer, close top-trailing, identity block below it) ·
//   https://mobbin.com/screens/663f3d6a-ca6d-4eec-b3e4-c122b70c8da8 (Noom — the
//   drawer's own dismiss sits above the identity block, not in the app bar) ·
//   https://mobbin.com/screens/fc3e0836-439c-468a-b475-a1c6a9aed459 (Fabric —
//   dismiss inline with the drawer's first row rather than floating over it) ·
//   https://mobbin.com/screens/a8dcb5a4-d0e5-4bc2-92b7-35e9e08e8a6d (X — drawer
//   as a distinct plane the content ground reads through, no header chrome)
import { Pressable } from './primitives';
import { Menu, X } from './icons';

/*
  A discriminated union, not `action` beside an optional `expanded`.

  `aria-expanded` belongs to the DISCLOSURE TRIGGER and to nothing else. The
  close button is inside the thing that is already expanded, so an
  `aria-expanded` on it would either be a constant `true` (noise) or a second
  place the drawer's state has to be threaded to. Making the prop unreachable
  from `action: 'close'` is cheaper than documenting that it must not be passed.
*/
export type NavDrawerButtonProps =
  | {
      action: 'open';
      /** The drawer's real state — this button is its disclosure trigger. */
      expanded: boolean;
      /** `id` of the nav this discloses, when the drawer's list carries one. */
      controls?: string;
      onPress: () => void;
      className?: string;
    }
  | { action: 'close'; onPress: () => void; className?: string };

/*
  One geometry, two glyphs.

  44px comes from `target-adult`, the kit's floor for an adult-facing control,
  and the glyph is 20 rather than the 16 the Cool hamburger shipped. Both
  platforms put a nav-chrome glyph at roughly half its target — Material's icon
  button is 24dp in 48dp, Apple's bar glyphs sit near 22pt in 44pt — and 16-in-44
  read as a small mark adrift in a large box.

  `rounded-control`, never `rounded-full`: the radius law (doc 02 §A.5) bans
  pill-ifying the language, and check-controls enforces it.

  The ink and hairline are the HEADER's, on both instances, and that is a
  measured choice rather than an oversight — the close button rides
  `tenant-sidebar` while the hamburger rides `tenant-header`, and
  `tenant-header-foreground` clears AA on both grounds (12.37:1 light,
  11.69:1 dark on the sidebar; the pair is declared in check-contrast). Giving
  the close its own plane's ink would have made the two controls two components
  again for no contrast gain.
*/
const BOX =
  'min-h-target-adult min-w-target-adult shrink-0 items-center justify-center rounded-control ' +
  'border-2 border-tenant-header-border transition-colors duration-fast hover:bg-tenant-surface-subtle ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring motion-reduce:transition-none';

const GLYPH = 'h-5 w-5 text-tenant-header-foreground';

export function NavDrawerButton(props: NavDrawerButtonProps) {
  const { action, onPress, className } = props;
  return (
    <Pressable
      aria-label={action === 'open' ? 'Open menu' : 'Close menu'}
      aria-expanded={action === 'open' ? props.expanded : undefined}
      aria-controls={action === 'open' ? props.controls : undefined}
      onPress={onPress}
      className={`${BOX} ${className ?? ''}`}
    >
      {action === 'open' ? (
        <Menu aria-hidden className={GLYPH} />
      ) : (
        <X aria-hidden className={GLYPH} />
      )}
    </Pressable>
  );
}
