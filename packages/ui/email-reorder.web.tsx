'use client';
// Hook-based gestures for the current web/Safari campaign surface. Document
// geometry comes through the platform primitive; editing stays in repo UI.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: email reorder semantic gesture handler pan worklets shared values
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Section, View } from './primitives';
import { Text } from './Text';
import { useInstanceStore, useStore } from './use-instance-store';
import { readEmailRows, watchEmailInteraction } from './html/email-document.web';
// Without the extension Turbopack selects this .web.tsx file recursively.
import { emailMoveFeedback, resolveEmailDrag, validRows, type EmailDrag } from './email-reorder.ts';

const AnimatedView = Animated.createAnimatedComponent(View);
type ReorderContext = {
  scope: string; revision: string; cancellation: number; disabled: boolean;
  begin: (source: string, token: number, revision: string) => void;
  finish: (source: string, token: number, revision: string, canceled: boolean, x: number, y: number) => void;
  abort: (source: string, token: number) => void;
};
const Context = createContext<ReorderContext | null>(null);

export function EmailReorderGroup({ ids, revision, disabled, onMove, children }: {
  ids: readonly string[]; revision: string; disabled: boolean;
  onMove: (source: string, index: number) => void; children: ReactNode;
}) {
  const scope = useId();
  const active = useRef<EmailDrag | null>(null);
  const current = useRef({ ids, revision, disabled, onMove });
  const store = useInstanceStore(() => ({ cancellation: 0, moveCount: 0, announcement: '' }));
  const feedback = useStore(store, (state) => state);
  const cancel = useCallback(() => {
    active.current = null;
    store.setState((state) => ({ cancellation: state.cancellation + 1 }));
  }, [store]);
  useLayoutEffect(() => {
    current.current = { ids, revision, disabled, onMove };
    cancel();
  }, [ids, revision, disabled, onMove, cancel]);
  useEffect(() => watchEmailInteraction(cancel), [cancel]);
  useEffect(() => () => { active.current = null; }, []);

  const begin = (source: string, token: number, expected: string) => {
    const latest = current.current;
    if (latest.disabled || latest.revision !== expected || !latest.ids.includes(source)) return;
    const rows = readEmailRows(scope, latest.ids);
    active.current = validRows(rows) ? { source, token, revision: expected, rows } : null;
  };
  const abort = (source: string, token: number) => {
    if (active.current?.source === source && active.current.token === token) cancel();
  };
  const finish: ReorderContext['finish'] = (source, token, expected, canceled, x, y) => {
    const latest = current.current;
    const snapshot = active.current;
    // A late event from another handle cannot consume this handle's transaction.
    if (snapshot?.source !== source || snapshot.token !== token) return;
    active.current = null;
    if (latest.disabled || expected !== latest.revision) return;
    const move = resolveEmailDrag(snapshot, source, token, latest.revision, canceled, readEmailRows(scope, latest.ids), x, y);
    if (!move) return;
    latest.onMove(move.source, move.index);
    store.setState((state) => emailMoveFeedback(state.moveCount, move.index));
  };

  return <Context.Provider value={{ scope, revision, disabled, cancellation: feedback.cancellation, begin, finish, abort }}>
    <GestureHandlerRootView>
      <View className="gap-group" onLayout={cancel}>{children}</View>
      <View accessibilityLiveRegion="polite"><Text tone="muted">{feedback.announcement}</Text></View>
    </GestureHandlerRootView>
  </Context.Provider>;
}

export function EmailBlockFrame({ id, label, disabled, children }: {
  id: string; label: string; disabled: boolean; children: ReactNode;
}) {
  const group = useContext(Context);
  if (!group) throw new Error('EmailBlockFrame requires EmailReorderGroup');
  const { revision, begin, finish, abort, cancellation } = group;
  const offset = useSharedValue(0);
  const token = useSharedValue(0);
  const tainted = useSharedValue(false);
  useEffect(() => { offset.set(0); tainted.set(true); }, [cancellation, disabled, offset, tainted]);
  const pan = usePanGesture({
    enabled: !disabled && !group.disabled,
    maxPointers: 1,
    onActivate: () => {
      'worklet';
      token.set(token.get() + 1); tainted.set(false);
      scheduleOnRN(begin, id, token.get(), revision);
    },
    onUpdate: (event) => {
      'worklet';
      if (event.numberOfPointers !== 1) tainted.set(true);
      if (!tainted.get()) offset.set(event.translationY);
    },
    onDeactivate: (event) => {
      'worklet';
      offset.set(0);
      scheduleOnRN(finish, id, token.get(), revision, event.canceled || tainted.get(), event.absoluteX, event.absoluteY);
    },
    onFinalize: (event) => {
      'worklet';
      offset.set(0);
      if (event.canceled) scheduleOnRN(abort, id, token.get());
    },
  });
  // Turbopack does not run the Worklets Babel plugin on web, so Reanimated
  // needs explicit dependencies to mount and subscribe to the shared value.
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }), [offset]);
  return <Section nativeID={`${group.scope}-${id}`} aria-label={label} className="gap-element rounded-card border border-border p-inset">
    <AnimatedView style={style} className="gap-group">
      <GestureDetector gesture={pan} touchAction="none" userSelect="none">
        <View accessibilityLabel={`Drag ${label}. Move up and Move down are also available.`} className="min-h-target-adult justify-center">
          <Text tone="muted">Drag {label}</Text>
        </View>
      </GestureDetector>
      {children}
    </AnimatedView>
  </Section>;
}
