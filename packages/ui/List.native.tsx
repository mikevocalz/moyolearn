'use client';
import { isValidElement } from 'react';
import { Host, List as ExpoList, ListItem as ExpoListItem } from '@expo/ui';
import { NativeSlot } from './NativeSlot.native';
import type { ListProps, ListItemProps } from './List.types';

/**
 * Platform list.
 *
 * Worth handing over for the same reason as the slider: row recycling, the
 * platform's own pull-to-refresh, swipe affordances and selection semantics are
 * behaviour rather than appearance, and the native implementations already have
 * them.
 *
 * Rows may still hold kit components: `ListItem` bridges its children through
 * `NativeSlot` (RNHostView), so an Avatar or a Badge renders inside a native
 * row with its classNames intact.
 *
 * Still not a replacement for `VirtualList` (@legendapp/list): that one
 * virtualises long, uniform React Native lists. Use this where the platform's
 * own list behaviour — pull to refresh, native separators and selection — is
 * what matters.
 *
 * NEVER NEST IT IN A SCROLLER. On Android this is a Compose LazyColumn, and a
 * LazyColumn measured with an unbounded height throws
 * `IllegalStateException: Vertically scrollable component was measured with an
 * infinity maximum height constraints` — a native crash, not a layout glitch.
 * Any RN `ScrollView` ancestor gives it exactly that, which rules out every
 * `BottomSheet` (its `SheetSurface` always wraps children in one). Inside a
 * scroller, lay rows out with kit primitives instead; this component belongs at
 * the top of a screen that scrolls itself.
 */
export function List({ children, onRefresh }: ListProps) {
  return (
    <Host matchContents>
      <ExpoList onRefresh={onRefresh}>{children}</ExpoList>
    </Host>
  );
}

export function ListItem({ children, onPress, leading, trailing, supportingText }: ListItemProps) {
  return (
    <ExpoListItem
      onPress={onPress}
      leading={leading}
      trailing={trailing}
      supportingText={supportingText}
    >
      {isValidElement(children) ? <NativeSlot>{children}</NativeSlot> : children}
    </ExpoListItem>
  );
}
