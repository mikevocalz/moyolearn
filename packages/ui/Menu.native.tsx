'use client';
import { useRef } from 'react';
import { Modal, useWindowDimensions, View as RNView } from 'react-native';
import { createStore, useStore } from 'zustand';
import { Pressable, View } from './primitives';
import { Text } from './Text';
import { haptics } from './haptics';
import type { MenuProps } from './Menu.types';

/** Panel geometry. Kept here so the clamp maths reads in one place. */
const PANEL_WIDTH = 220;
const SCREEN_MARGIN = 8;
const TRIGGER_GAP = 4;

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Per-instance menu state: whether it is open and where its trigger sits.
 * A ref-held vanilla store rather than React state (repo rule), and per
 * instance because a screen can hold several menus.
 */
function createMenuStore() {
  return createStore<{
    open: boolean;
    anchor: Anchor | null;
    show: (anchor: Anchor) => void;
    hide: () => void;
  }>((set) => ({
    open: false,
    anchor: null,
    show: (anchor) => set({ open: true, anchor }),
    hide: () => set({ open: false }),
  }));
}

/**
 * A menu anchored to its trigger, drawn by the kit.
 *
 * DRAWN, NOT NATIVE — deliberately, and for the same reason as `Switch` and
 * `SegmentedControl`. `@expo/ui`'s community menu renders Android's Material
 * `DropdownMenu`, which owns its own surface: a plain elevated card with
 * Material type, no border, and no state feedback that matches anything else
 * here. Beside controls that are all 2px-ink slabs with hard offset shadows it
 * read as a component from another app, and there was no hover or pressed state
 * to speak of.
 *
 * The rule this follows: controls whose value is BEHAVIOUR (TextInput, Picker,
 * Slider, List) come from `@expo/ui`; controls whose value is CHROME are drawn
 * from the kit's tokens.
 *
 * Still a menu and not a sheet: it opens beside the control that summoned it,
 * measured at press time so it tracks the trigger wherever the layout puts it,
 * and clamped so it can never open off-screen.
 */
export function Menu({ children, actions, onAction, title, className }: MenuProps) {
  const store = useRef<ReturnType<typeof createMenuStore> | null>(null);
  store.current ??= createMenuStore();
  const open = useStore(store.current, (state) => state.open);
  const anchor = useStore(store.current, (state) => state.anchor);

  // measureInWindow needs a real host view; the kit's Pressable does not
  // forward refs, so the wrapper is what gets measured.
  const triggerRef = useRef<RNView>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      haptics.selection();
      store.current?.getState().show({ x, y, width, height });
    });
  };

  // Right-aligned to the trigger, because an overflow control sits at the
  // trailing edge of a bar and a left-aligned panel would hang off the screen.
  const left = anchor
    ? Math.min(
        Math.max(SCREEN_MARGIN, anchor.x + anchor.width - PANEL_WIDTH),
        screenWidth - PANEL_WIDTH - SCREEN_MARGIN,
      )
    : SCREEN_MARGIN;
  const top = anchor ? Math.min(anchor.y + anchor.height + TRIGGER_GAP, screenHeight - 80) : 0;

  return (
    <>
      <RNView ref={triggerRef} collapsable={false}>
        <Pressable aria-haspopup onPress={openMenu} className={className}>
          {children}
        </Pressable>
      </RNView>

      <Modal
        visible={open}
        transparent
        // Android's hardware Back closes the menu rather than leaving it
        // stranded over the screen.
        onRequestClose={() => store.current?.getState().hide()}
        animationType="fade"
      >
        {/* Backdrop: dismisses on an outside press, which is what makes the
            menu feel like a menu rather than a stuck panel. */}
        <Pressable
          aria-label="Dismiss menu"
          onPress={() => store.current?.getState().hide()}
          className="flex-1"
        >
          <View
            style={{ left, top, width: PANEL_WIDTH }}
            className="absolute gap-1 rounded-md border-2 border-border bg-surface-raised p-1 shadow-overlay"
          >
            {title ? (
              <Text
                numberOfLines={1}
                className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"
              >
                {title}
              </Text>
            ) : null}

            {actions.map((action) => (
              <Pressable
                key={action.id}
                role="menuitem"
                aria-label={action.title}
                aria-disabled={action.disabled}
                onPress={() => {
                  if (action.disabled) return;
                  store.current?.getState().hide();
                  onAction(action.id);
                }}
                // Every state is designed: hover for pointer devices, a pressed
                // state for touch, a distinct destructive treatment, and a
                // disabled one — the Material menu gave none of these.
                className={`min-h-11 justify-center rounded-sm px-3 py-2 transition-colors duration-fast motion-reduce:transition-none ${
                  action.disabled
                    ? 'opacity-40'
                    : action.destructive
                      ? 'hover:bg-danger/10 active:bg-danger/15'
                      : 'hover:bg-surface-sunken active:bg-primary'
                }`}
              >
                <Text
                  className={`text-base font-medium ${
                    action.destructive ? 'text-danger' : 'text-text'
                  }`}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
