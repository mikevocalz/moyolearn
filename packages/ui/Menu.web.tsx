'use client';
import { Pressable, View } from './primitives';
import { Text } from './Text';
import type { MenuProps } from './Menu.types';

/**
 * Web menu, drawn in the kit's language.
 *
 * `details`/`summary` gives open-on-click, close-on-outside-click and Escape
 * for free, with the correct semantics — no state, no listeners, no focus trap
 * to get wrong.
 */
export function Menu({ children, actions, onAction, title, className }: MenuProps) {
  return (
    /*
      `open:z-50` on the DETAILS, not just on the panel.

      The panel already had a background and `z-10`, and rows below it still
      painted straight through — because in a table every row is a positioned
      sibling at `z-index: auto`, so a later row wins on DOM order no matter what
      z-index a child of an earlier row asks for. The lift has to happen on the
      element that is a sibling of those rows. Scoped to `open` so a closed menu
      never steals the stack from anything.
    */
    <details className={`relative open:z-50 ${className ?? ''}`}>
      <summary className="cursor-pointer list-none">{children}</summary>
      {/* `isolate` so the panel's own children stack against the panel rather
          than against whatever ancestor happens to be the nearest context. */}
      <View className="absolute right-0 top-full isolate z-50 mt-1 min-w-48 gap-1 rounded-md border-2 border-border bg-surface-raised p-1 shadow-overlay">
        {title ? (
          <Text className="px-2 py-1 text-xs font-semibold uppercase text-text-muted">{title}</Text>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.id}
            role="menuitem"
            aria-disabled={action.disabled}
            onPress={() => !action.disabled && onAction(action.id)}
            className={`min-h-11 justify-center rounded-sm px-3 py-2 transition-colors duration-fast motion-reduce:transition-none ${
              action.disabled ? 'opacity-50' : 'hover:bg-surface-sunken'
            }`}
          >
            <Text
              className={`text-base ${action.destructive ? 'text-danger' : 'text-text'}`}
            >
              {action.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </details>
  );
}
