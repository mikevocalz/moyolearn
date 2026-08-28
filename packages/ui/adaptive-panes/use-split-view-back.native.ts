'use client';
// PLATFORM FORK — native. Android hardware Back for the collapsed panes; a
// deliberate no-op on iOS, where back is the navigator's swipe/edge gesture
// and there is no hardware button to arbitrate. The web fork is a separate
// no-op so expo-router never enters the web module graph.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md (Back behaviour)
// SOT-KEYWORDS: split view back handler android hardware press column step fork
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router } from 'expo-router';
import { resolveSearchBack } from './pane-search';
import { usePaneSearchStore } from './pane-search.store';
import type { AdaptivePanesStore } from './store';
import type { SplitNavigableColumn } from './types';

/**
 * Hardware Back for the collapsed split view.
 *
 * SUBSCRIPTION ORDERING — this is the load-bearing detail.
 * `BackHandler.android.js` walks `_backPressSubscriptions` last-registered-
 * first and stops at the first handler returning `true`. expo-router's
 * navigation container mounts ABOVE the split view, so it subscribes EARLIER
 * and therefore runs AFTER this handler. Returning `false` from here is what
 * hands the press down to it to pop the detail stack — we never call
 * `router.back()` ourselves, which would double-pop by racing the container.
 *
 * PREDICTIVE BACK — apps/mobile/android/app/src/main/AndroidManifest.xml has
 * `android:enableOnBackInvokedCallback="false"`, so this app is on the legacy
 * dispatcher and `hardwareBackPress` is authoritative. If that flag is ever
 * flipped to `true`, this hook must move to `onBackInvokedCallback`, because
 * the legacy event stops firing for the predictive gesture.
 *
 * Only subscribes while collapsed AND on Android: at every expanded size class
 * the columns are all on screen, so there is no column to step back to, and
 * off Android there is no hardware Back event to subscribe to — iOS's
 * BackHandler stub never fires, so registering there is dead weight at best.
 *
 * The host passes its own STORE rather than this hook reading context: the
 * hook runs in the host's body, above where the provider renders.
 */
export function useSplitViewBack(params: {
  collapsed: boolean;
  activeColumn: SplitNavigableColumn;
  columnCount: 1 | 2;
  store: AdaptivePanesStore;
}): void {
  const { collapsed, activeColumn, columnCount, store } = params;

  useEffect(() => {
    if (!collapsed || Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Search state is read at press time rather than closed over, so the
      // handler does not need re-subscribing on every keystroke — resubscribing
      // would also move it to the front of BackHandler's list and break the
      // ordering this hook depends on.
      const searchStore = usePaneSearchStore.getState();
      const outcome = resolveSearchBack({
        searches: searchStore.panes,
        activeColumn,
        columnCount,
        canGoBack: router.canGoBack(),
      });

      // Priority order is decided in resolveSearchBack; this only applies it.
      if (outcome.kind === 'clearQuery') {
        searchStore.clear(outcome.pane);
        return true;
      }
      if (outcome.kind === 'blurSearch') {
        searchStore.setFocused(outcome.pane, false);
        return true;
      }
      if (outcome.kind === 'step') {
        store.getState().setColumn(outcome.column);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [collapsed, activeColumn, columnCount, store]);
}
