// Grow-with-content height for the composer field — native.
//
// This used to run RN's `onContentSizeChange` loop: measure the content, store
// the height, hand it back as a style. None of it ever reached the device. The
// field is `@expo/ui`'s universal TextInput (`html/native-input.native.tsx`),
// whose prop surface has no `onContentSizeChange`, and the height it returned
// was overwritten by the floor the composer set afterwards. It was a mechanism
// for a field that had stopped existing.
//
// The host already does the measuring: `matchContents.vertical` sizes the
// Compose/SwiftUI view to its own text, which is a native measurement per frame
// rather than a JS round-trip per keystroke. So the hook's whole job on native
// is to supply the two bounds that measurement happens between — a floor so an
// empty field is one level row, and a ceiling so it stops.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textinput height native matchcontents android

import type { AutoGrowProps } from './use-autogrow.types';

/*
  NO CEILING HERE, and that is a measured result rather than an omission.

  `MAX_LINES` is enforced on web, where the effect can read the element's real
  line-height. The native equivalent — a `maxHeight` on the Host — was tried on
  device and does the wrong thing: it clamps the host's MEASURED BOX without
  clamping the Compose content inside it. The accessibility tree caught it
  exactly, `ComposeView (…, 0.078)` (the 56 floor) wrapping
  `TextField (…, 0.182)` (131), so a long answer painted straight out of its own
  bordered box and under the keyboard. A `maxHeight` on the RN wrapper is inert
  for the same reason — the hosted view is not laid out by Yoga.

  What Compose does honour is `maxLines`, and @expo/ui's universal TextInput
  ties `numberOfLines` to minLines AND maxLines together, so asking for a
  four-line ceiling also asks for a four-line FLOOR — the tall empty bar this
  work exists to remove. Capping it properly needs the field's content height
  fed back through `onContentSizeChange`, which is a per-keystroke state machine
  and not something to land untested on demo day. Filed in the handoff.
*/

/**
 * @param floor The composer row's resting height — the age band's touch target,
 * so the field and the keys either side of it start level.
 */
export function useAutoGrow(_value: string, floor: number): AutoGrowProps {
  /*
    The floor is what keeps the field FOCUSABLE on Android, not just level.

    `matchContents.vertical` makes the host measure the native text, and Compose
    returned zero for that measurement on first layout: the accessibility tree
    showed `ComposeView (…, 0.000)` around a TextField that still painted its
    placeholder, so the composer looked correct and could not be typed into at
    all. Anything that removes this bound takes the tutor's core interaction
    with it.
  */
  return { style: { minHeight: floor } };
}
