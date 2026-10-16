'use client';
// GuardianAssignSheet — "Upload work for <child>", the guardian's entry into
// the existing CaptureScreen on a ward's behalf.
//
// One trigger, one surface, no new sheet library. On a compact window the
// surface is the kit `BottomSheet` (@expo/ui under the hood, two snap points);
// from medium up it is a panel anchored under the trigger, beside the child
// switcher, because a full-width sheet sliding over a tablet's two-pane feed
// hides the very list the parent was reading. The size class comes from
// `useWindowSizeClass`, which re-renders on rotation, fold and split-screen, so
// a sheet open across an unfold becomes the panel without losing its content.
//
// The surface names the child in its title and again in a row with the avatar
// before offering the action, because the one mistake this entry can make is
// uploading a sibling's worksheet under the wrong name. Choosing pages routes to
// `/upload`, the guardian-shell capture route; B2's CaptureScreen reads
// `useActiveLearnerId()` for `forLearnerAuthId`, so the ward is carried by the
// family store rather than by a route param a link could tamper with.
//
// The anchored panel is a transparent react-native `Modal`, not an absolutely
// positioned View. On web that is react-native-web's Modal, which brackets
// focus inside the panel, closes on Escape through `onRequestClose`, and
// returns focus to the trigger on close; on iOS and Android the Modal is a
// separate window, so VoiceOver and TalkBack cannot wander onto the feed
// behind it. A positioned View gave none of that and claimed `aria-modal`
// anyway. The panel is placed from the trigger's `measureInWindow` box, the
// same way the kit Menu places itself, and flips above the trigger or clamps
// into the window when there is no room below.
//
// Open state and the measured anchor live in a Zustand instance store (the
// kit's `useInstanceStore`), never `useState`, per the repo rule.
// Mobbin: https://mobbin.com/screens/f4b7f39d-a244-4ed9-a544-d91838b00566 (Alan — a short bottom sheet: close affordance, then "Take a photo / Choose a photo / Choose a file" as plain rows) ·
//   https://mobbin.com/screens/2f99a08e-bb58-450d-87d3-b4c7a4073e82 (Notion — titled "Insert Media" sheet over the File page, four plain source rows) ·
//   https://mobbin.com/screens/0c6dce7f-4bea-44df-bccc-d516dc87221d (Etsy web — the account action list opens as a panel anchored under its trigger in the header rather than a modal). Structure only.
// SOT: docs/work/pr-100/contract.md §Routes · docs/design/homework-end-to-end-2026.md §Screen contract (Parent Home) · docs/design/mobbin/homework-assign-sheet.md
// SOT-KEYWORDS: guardian assign sheet upload work for child bottom sheet anchored panel size class capture route

import { useRef, type ComponentRef } from 'react';
import { Modal, useWindowDimensions, View as RNView } from 'react-native';
import { useRouter } from 'solito/navigation';
import {
  Avatar,
  BottomSheet,
  Button,
  useInstanceStore,
  useStore,
  useWindowSizeClass,
  isCollapsed,
} from '@acme/ui';
import { Pressable, View, Text as TWText } from '@acme/ui/tw';
import type { ChildSummary } from '../family/family.store.ts';

/** The guardian-shell capture route (apps/mobile/app/(guardian)/upload.tsx, apps/web/app/(guardian)/upload/page.tsx). */
export const GUARDIAN_UPLOAD_PATH = '/upload';

/** Panel width in dp; 22rem on web. Narrower than any medium window (600dp). */
const PANEL_WIDTH = 352;
/** Estimated panel height for the flip decision; `maxHeight` is the backstop. */
const PANEL_HEIGHT_ESTIMATE = 300;
const TRIGGER_GAP = 8;
const WINDOW_MARGIN = 16;

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AssignSheetState {
  open: boolean;
  anchor: Anchor | null;
}

export interface GuardianAssignSheetProps {
  /** The active ward. Nothing renders without one: there is nobody to upload for. */
  child: ChildSummary | undefined;
}

/**
 * Where the panel goes: below the trigger, left edges aligned, unless that runs
 * off the bottom, in which case above it; clamped inside the window margins
 * either way.
 */
function placePanel(
  anchor: Anchor,
  window: { width: number; height: number },
): { left: number; top: number; maxHeight: number } {
  const maxHeight = window.height - WINDOW_MARGIN * 2;
  const left = Math.min(
    Math.max(WINDOW_MARGIN, anchor.x),
    window.width - PANEL_WIDTH - WINDOW_MARGIN,
  );
  const below = anchor.y + anchor.height + TRIGGER_GAP;
  const fitsBelow = below + PANEL_HEIGHT_ESTIMATE <= window.height - WINDOW_MARGIN;
  const above = anchor.y - TRIGGER_GAP - PANEL_HEIGHT_ESTIMATE;
  const top = Math.max(
    WINDOW_MARGIN,
    Math.min(fitsBelow ? below : above, window.height - WINDOW_MARGIN - PANEL_HEIGHT_ESTIMATE),
  );
  return { left: Math.max(WINDOW_MARGIN, left), top, maxHeight };
}

export function GuardianAssignSheet({ child }: GuardianAssignSheetProps) {
  const router = useRouter();
  const sizeClass = useWindowSizeClass();
  const compact = isCollapsed(sizeClass);
  const window = useWindowDimensions();
  const store = useInstanceStore<AssignSheetState>(() => ({ open: false, anchor: null }));
  const open = useStore(store, (s) => s.open);
  const anchor = useStore(store, (s) => s.anchor);
  // measureInWindow needs a host view; the kit Button does not forward refs.
  // `ComponentRef<typeof RNView>` rather than RN's `ViewInstance`: the mobile
  // app's react-native types do not export `ViewInstance`, and this file is
  // typechecked by both apps.
  const triggerRef = useRef<ComponentRef<typeof RNView>>(null);

  if (child === undefined) return null;

  const close = () => {
    store.setState({ open: false });
  };
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    if (compact || triggerRef.current === null) {
      store.setState({ open: true });
      return;
    }
    triggerRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
      store.setState({ open: true, anchor: { x, y, width, height } });
    });
  };

  const title = `Upload work for ${child.name}`;
  const goToCapture = () => {
    close();
    router.push(GUARDIAN_UPLOAD_PATH);
  };

  const body = (
    <View className="gap-stack">
      <View className="flex-row items-center gap-element">
        <Avatar name={child.name} size="md" />
        <View className="min-w-0 flex-1">
          <TWText className="text-base font-semibold text-text">{child.name}</TWText>
          <TWText className="text-sm text-text-muted">
            This worksheet will be saved to {child.name}’s record.
          </TWText>
        </View>
      </View>
      <TWText className="text-body text-text">
        Take photos of the pages or import a PDF. You’ll check what was read before anything is
        saved. Then {child.name} starts question one with Natalie.
      </TWText>
      <View className="flex-row flex-wrap items-center gap-stack">
        <Button title="Choose pages" onPress={goToCapture} />
        <Button title="Not now" variant="ghost" onPress={close} />
      </View>
    </View>
  );

  const placement = anchor === null ? null : placePanel(anchor, window);

  return (
    <View className="self-start">
      <RNView ref={triggerRef} collapsable={false}>
        <Button
          title={title}
          variant="outline"
          onPress={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
        />
      </RNView>
      {compact ? (
        <BottomSheet open={open} onClose={close} title={title}>
          {body}
        </BottomSheet>
      ) : (
        <Modal
          visible={open && placement !== null}
          transparent
          animationType="fade"
          // Android Back and web Escape both arrive here.
          onRequestClose={close}
        >
          {/*
            Transparent click-away layer: a tap on the feed closes the panel
            instead of landing on a card under it. The page is not dimmed,
            because the switcher beside the trigger is the context the parent
            is checking against.
            The backdrop is a sibling: wrapping the dialog would nest every
            action inside a button on web and break its HTML semantics.
          */}
          <View className="flex-1">
            <Pressable aria-label="Close" onPress={close} className="absolute inset-0" />
            {placement ? (
              <View
                role="dialog"
                aria-modal
                aria-label={title}
                accessibilityViewIsModal
                style={{
                  left: placement.left,
                  top: placement.top,
                  width: PANEL_WIDTH,
                  maxWidth: window.width - WINDOW_MARGIN * 2,
                  maxHeight: placement.maxHeight,
                }}
                className="absolute rounded-card border-2 border-border bg-surface-raised p-inset shadow-card"
              >
                <View className="mb-3 flex-row items-center justify-between gap-stack">
                  <TWText
                    role="heading"
                    className="flex-1 font-display text-xl font-semibold text-text"
                  >
                    {title}
                  </TWText>
                  <Pressable
                    onPress={close}
                    aria-label="Close"
                    role="button"
                    className="min-h-11 min-w-11 items-center justify-center rounded-md bg-surface-sunken active:opacity-70"
                  >
                    <TWText className="text-base leading-none text-text">✕</TWText>
                  </Pressable>
                </View>
                {body}
              </View>
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}
