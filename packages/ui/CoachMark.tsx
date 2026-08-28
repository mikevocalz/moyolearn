'use client';
// CoachMark — doc 37 §4 (PR-147). One tip, taught at the point of use, shown
// once, dismissed by hand, never a modal.
//
// THE WHOLE POINT IS WHAT IT IS NOT. Doc 37 §1.2 is that contextual beats
// front-loaded: a tour is skipped and forgotten, so the camera is taught at the
// camera and the notes at the notes. Three properties carry that, and each one
// is structural rather than a habit call sites are asked to keep:
//
//   · NOT A MODAL. This renders inline, in the tree, in normal flow — no
//     portal, no `Modal`, no scrim, nothing captures focus. Everything behind
//     it stays visible and usable, so a child who ignores it loses nothing.
//     `Dialog` and `BottomSheet` are the kit's modal surfaces and were the
//     wrong bases for exactly that reason; `ToastCard` was the near miss —
//     right size, wrong lifetime, since a toast is transient and announces a
//     thing that just happened rather than teaching a thing about to.
//   · NEVER STACKED. The store hands out one slot; a second tip mounted in the
//     same moment renders nothing and stays un-taught for next time.
//   · NOT NAGGING. It appears once per device and dismissing it is one tap.
//     On a learner surface that matters more than anywhere else (CLAUDE.md
//     §Children's surfaces): it never re-asks, never counts down, and carries
//     no action but "I read it".
//
// The seen flag is written on DISMISS, not on display. A tip nobody
// acknowledged was never taught, and burning it because a screen flashed past
// would leave the child worse off than showing it twice.
//
// Mobbin: https://mobbin.com/screens/eddbcaf5-e84e-49c2-9a17-ea528204eb81 (Mesh —
// the tip is docked as a SIBLING of the bar it names, with a caret onto it,
// rather than floated over the screen; that is the layout this component
// assumes) · https://mobbin.com/screens/6255fa9c-c07f-4abf-8ca1-123f9eb1f9d1
// (Opera — caret pointing UP at an anchor above the card, i.e. `placement
//="below"`, with title / body / one action stacked) ·
// https://mobbin.com/screens/df87f8e0-d810-4593-bb39-8b0a01a3c493 (MD Vinyl —
// caret centred beneath the card over a bottom bar, the `placement="above"`
// case, and the reason `align` exists at all) ·
// https://mobbin.com/screens/5f9444a2-a55d-4358-98ce-f3f9f2635768 (Tabby — ONE
// action, bottom-right, no close glyph competing with it for the same job) ·
// https://mobbin.com/screens/8e52a60c-69ba-41b3-9828-3c9d44328ef6 (monday.com —
// the content behind stays legible; we take the layout and deliberately not its
// dimmed backdrop, which is the modal stacking doc 37 §4 forbids)
// Structure only. The slab border, the hard offset shadow, the spacing tiers and
// the type ramp are docs 02/08.
// SOT: docs/pack/37-onboarding-dual-pane.md §1.2 §4 · CLAUDE.md (Children's surfaces)
// SOT-KEYWORDS: coach mark tip contextual onboarding once dismissible non modal caret anchor teach at point of use

import { useEffect } from 'react';
import { tv } from './tv';
import { View } from './primitives';
import { Text } from './Text';
import { Button, type ButtonProps } from './Button';
import { FadeIn, useHydrated } from './motion';
import { useCoachMarkStore } from './coach-mark.store';
import type { CoachMarkId } from './coach-mark.store.shared.ts';

const coachMark = tv({
  slots: {
    root: 'w-full gap-0',
    card:
      'w-full max-w-content-form gap-stack self-center rounded-card border-2 border-border ' +
      'bg-surface-raised p-4 shadow-raised',
    head: 'flex-row items-start gap-stack',
    // The rounded square inside the rounded rectangle — the containment the
    // toasts and icon buttons already use, so a tip reads as part of this app.
    tile: 'h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-border bg-surface-sunken',
    body: 'flex-1 gap-0.5',
    footer: 'flex-row justify-end',
    /*
      A rotated square with two adjacent borders, overlapping the card by half
      its diagonal so the card's own border reads as continuous behind it. Paint
      order does the masking: for `above` the caret is drawn after the card and
      covers the seam; for `below` the card is drawn after the caret and covers
      the caret's tail. No z-index, which is inert in this stack anyway.
    */
    caret: 'h-3 w-3 rotate-45 border-border bg-surface-raised',
  },
  variants: {
    align: {
      start: { root: 'items-start', caret: 'ml-6' },
      center: { root: 'items-center' },
      end: { root: 'items-end', caret: 'mr-6' },
    },
    placement: {
      above: { caret: '-mt-1.5 border-b-2 border-r-2' },
      below: { caret: '-mb-1.5 border-l-2 border-t-2' },
    },
  },
  defaultVariants: { align: 'center', placement: 'above' },
});

export interface CoachMarkProps {
  /** Which one-time tip this is. The persistence namespace, closed by type. */
  id: CoachMarkId;
  title: string;
  /** One or two sentences. Anything longer is a screen, not a tip. */
  body: string;
  /** Optional glyph. Decorative — the title carries the meaning. */
  icon?: React.ReactNode;
  /** Where the thing being taught sits: `above` = card above it, caret points down. */
  placement?: 'above' | 'below';
  /** Which end of the card the caret sits at, to line up with the anchor. */
  align?: 'start' | 'center' | 'end';
  /** "Got it" reads wrong to a six-year-old; the call site owns the register. */
  dismissLabel?: string;
  /**
   * The dismiss control's size, which is where its touch target comes from.
   * Learner surfaces pass the age band's size (doc 08 §2.4) — a K–2 thumb needs
   * the 56/72 target, and a tip is not exempt from that because it is small.
   */
  size?: ButtonProps['size'];
  className?: string;
}

export function CoachMark({
  id,
  title,
  body,
  icon,
  placement = 'above',
  align = 'center',
  dismissLabel = 'Got it',
  size = 'md',
  className,
}: CoachMarkProps) {
  const seen = useCoachMarkStore((state) => state.seen[id] === true);
  const showing = useCoachMarkStore((state) => state.showing);
  const claim = useCoachMarkStore((state) => state.claim);
  const release = useCoachMarkStore((state) => state.release);
  const dismiss = useCoachMarkStore((state) => state.dismiss);

  /*
    Claim on mount, release on unmount. The screen-slot rule cannot live in
    render: two tips rendering in the same pass would each read `showing` as
    null and both draw.
  */
  useEffect(() => {
    if (seen) return;
    claim(id);
    return () => release(id);
  }, [id, seen, claim, release]);

  /*
    `useHydrated` gates the first paint on the web, where localStorage does not
    exist during SSR: without it the server would render a tip this device
    dismissed months ago and then tear it out on hydration. On native the
    snapshot is true from the first render, so this costs nothing there.
  */
  const hydrated = useHydrated();
  if (!hydrated || seen || showing !== id) return null;

  const s = coachMark({ align, placement });
  const caret = <View aria-hidden className={s.caret()} />;

  return (
    // `FadeIn` rather than a hand-rolled entrance: it already reads Reduce
    // Motion through `useReducedMotion` and renders its final frame statically
    // when that is on, which a CSS `motion-reduce:` class cannot do to a
    // JS-driven animation.
    <FadeIn className={s.root({ className })}>
      {placement === 'below' ? caret : null}
      {/*
        `status` rather than `alert`: a tip is polite by definition — it is
        announced when it appears and never interrupts what a screen reader is
        already saying. The dismiss control is a real focusable button, so the
        whole thing is reachable and closable from a keyboard and from a screen
        reader's own navigation.
      */}
      <View role="status" className={s.card()}>
        <View className={s.head()}>
          {icon ? <View aria-hidden className={s.tile()}>{icon}</View> : null}
          <View className={s.body()}>
            <Text variant="heading">{title}</Text>
            <Text tone="muted">{body}</Text>
          </View>
        </View>
        <View className={s.footer()}>
          <Button title={dismissLabel} variant="outline" size={size} onPress={() => dismiss(id)} />
        </View>
      </View>
      {placement === 'above' ? caret : null}
    </FadeIn>
  );
}
