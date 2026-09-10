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
export function Menu({ children, actions, onAction, title, placement = 'down', className }: MenuProps) {
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
      {/*
        THE TRIGGER MUST NOT BE INTERACTIVE CONTENT, and this one line is what
        enforces it.

        Every caller passes a control-shaped child — `<View role="button">` with
        the age band's touch target on it — and `role="button"` makes that child
        INTERACTIVE CONTENT. Chrome (correctly, per the HTML spec's activation
        behaviour) declines to toggle a `<details>` when the click lands on
        interactive content inside its `<summary>`, so the click bubbled, arrived
        with `defaultPrevented: false`, and nothing opened. Measured on
        `/tutor`: the composer's own "Add a photo or file" key had been dead on
        web for exactly this reason, and so was every other menu in the app.

        `pointer-events-none` on a wrapper makes the SUMMARY the click target
        again while the child keeps its size, its label and its ink. Nothing
        about the accessible name changes — a summary's name is computed from
        its contents either way — and the keyboard path (focus the summary,
        Enter) was never affected.
      */}
      <summary className="cursor-pointer list-none">
        <View className="pointer-events-none">{children}</View>
      </summary>
      {/* `isolate` so the panel's own children stack against the panel rather
          than against whatever ancestor happens to be the nearest context. */}
      <View
        className={`absolute right-0 isolate z-50 min-w-48 gap-1 rounded-md border-2 border-border bg-surface-raised p-1 shadow-overlay ${
          placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
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
