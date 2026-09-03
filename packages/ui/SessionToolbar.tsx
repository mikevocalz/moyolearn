'use client';
// SessionToolbar — header for the S9 tutor session surface.
//
// ONE HEADER DIALECT: back chevron at the leading edge, title LEFT-ALIGNED
// beside it, actions trailing. `ShellHeader` (apps/mobile) already reads that
// way — brand or chevron leading, title left, avatar trailing — and a session
// bar that centred its title was the one bar in the product with a different
// grammar, so walking from a tab into the session moved the screen's name.
// Left-alignment is also the only arrangement that survives a long session
// title: a centred title is squeezed from both sides by whatever the two edges
// happen to hold, while a left title truncates predictably at the actions.
//
// THE PRESENCE CONTROL IS STILL NOT HERE, and that is deliberate — it lives on
// the rail directly under Natalie (`TutorPresence`), which is both where the
// thing it controls is and where the status it reports belongs. This bar names
// the SESSION; she names herself.
//
// Mobbin: https://mobbin.com/screens/76e16697-0e20-4bfc-8162-e93d6f1fc8ff (Mistral
//   Le Chat — session title left in the bar, controls trailing, nothing centred) ·
//   https://mobbin.com/screens/6a3715d2-6cda-4f77-ad80-99787a5fde37 (WhatsApp web
//   — leading control, left-aligned title, actions trailing) ·
//   https://mobbin.com/screens/cb2fa17e-fa25-4f3f-8d39-3a6ed37ac492 (Lindy —
//   left-aligned title with its controls in the same row) ·
//   https://mobbin.com/screens/e1f475cd-9340-4b6d-98c3-9ad852993175 (Fibery — a
//   working header that never centres its title) ·
//   https://mobbin.com/screens/0ee68b98-add3-4ba5-bd3f-9e357f19bdf1 (Customer.io
//   — title and controls share one bar). Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §4.1 · §8 ·
//      docs/design/tutor-session-thread-first.md
// SOT-KEYWORDS: sessiontoolbar header tutor back captions tutor view left title

import { View, Text } from './primitives';
import { SafeArea } from './SafeArea';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { ChevronLeft } from './icons';

export interface SessionToolbarProps {
  /** The session, not the tutor — `TutorPresence` names her (doc 23 §2). */
  title: string;
  captionsEnabled?: boolean;
  onBack?: () => void;
  onToggleCaptions?: () => void;
  /**
   * The pane show/hide controls, when this session is drawn as a split view.
   *
   * A SLOT, not a set of booleans: what the panes are and what they are called
   * is the stage's business (`TutorStage` mounts `PaneToggle`s here), and a
   * header that knew the names of the tutor session's panes could not be the
   * one header dialect any more. Omitted — a phone, where the session is a
   * single spine — nothing is drawn and the title keeps the whole bar.
   *
   * WHY THE HEADER AND NOT THE PANE SEAM. `AdaptivePanes` draws its own control
   * row above the detail pane, which is right for an adult pane surface with a
   * navbar of its own. The session is immersive — it hides the shell header and
   * has exactly one bar — so a second control strip under that bar reads as a
   * second bar, and it sat above only ONE of the two panes it governs. In the
   * header both controls are equidistant from both panes and present from first
   * paint, which is where the learner looked for them.
   */
  paneControls?: React.ReactNode;
  className?: string;
}

/*
  THE PRESENCE CONTROL IS NOT HERE.

  It used to be: a text button cycling visible → compact → audio-only, wedged
  between the back chevron and the title. Three problems, all of them worse at
  phone width. Its label named a transition ("Make Natalie smaller") rather than
  a state, so it never told the child where she currently was; the cycle meant
  returning from voice-only cost two presses; and a long label in a three-slot
  header squeezed the session title out on a narrow screen.

  It now lives on the rail directly under Natalie (`TutorPresence`), which is
  both where the thing it controls is and where the status it reports belongs.
*/
export function SessionToolbar({
  title,
  captionsEnabled,
  onBack,
  onToggleCaptions,
  paneControls,
  className,
}: SessionToolbarProps) {
  const hasRightAction = onToggleCaptions !== undefined || paneControls !== undefined;

  /*
    The top inset lives HERE, not in each caller. This is the first row of an
    immersive surface — the session hides the shell's own header — so without it
    the toolbar renders under the status bar and the whole screen reads as
    shifted up. `ShellHeader` already takes the same inset for the tabbed
    shells; a session must not be the one place chrome forgets. `SafeArea` is a
    plain passthrough on web, so this costs the web fork nothing.
  */
  return (
    <SafeArea edges={['top']} className="bg-surface-header">
      <View
        /*
          THE SHELL'S CHROME DIALECT, not a bespoke one. This bar carried
          `border-strong` on the content ground while every other bar in the
          product is `bg-surface-header` with `on-surface-header` ink and a
          `min-h-14` row — so walking from a tab into the tutor session looked
          like leaving the app. A session is immersive in what it OMITS (the tab
          bar, the wordmark) and in nothing else; its bar is still the product's
          bar. `RoleScope` re-points the pair per door, so this follows the
          learner's colour without naming it.
        */
        className={`min-h-14 flex-row items-center gap-stack border-b-2 border-on-surface-header bg-surface-header px-4 py-1 ${className ?? ''}`}>
        <IconButton
          icon={<ChevronLeft className="h-5 w-5" />}
          aria-label="Back"
          onPress={onBack}
          variant="ghost"
          size="md"
        />
        {/* `flex-1`, not `justify-between`: the title takes the space between
            the chevron and the actions and reads from the leading edge, so it
            sits where every other bar in the product puts it. */}
        <Text
          numberOfLines={1}
          className="flex-1 truncate font-sans text-title font-bold text-on-surface-header">
          {title}
        </Text>
        {hasRightAction ? (
          <View className="shrink-0 flex-row items-center gap-element">
            {/* Layout controls lead the action group and captions trail it: the
                pane toggles change the SHAPE of the screen and CC changes what
                is written on it, so the two kinds do not interleave. */}
            {paneControls}
            {onToggleCaptions ? (
              <Button
                title="CC"
                variant={captionsEnabled ? 'primary' : 'ghost'}
                size="sm"
                onPress={onToggleCaptions}
                aria-label="Toggle captions"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeArea>
  );
}
