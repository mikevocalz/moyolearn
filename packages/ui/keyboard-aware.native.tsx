'use client';
import Animated from 'react-native-reanimated';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { css } from './html/css';

/**
 * A scroll view that keeps the focused field above the keyboard.
 *
 * `react-native-keyboard-controller`, never React Native's
 * `KeyboardAvoidingView`: iOS reports a scheduled keyboard animation while
 * modern edge-to-edge Android reports per-frame insets, and RN's component has
 * no per-frame Android primitive — so Android content snaps instead of tracking
 * the keyboard. This library maps both onto one animated value.
 *
 * Wrapped with `createAnimatedComponent` so it can also carry a Reanimated
 * scroll handler — that is what lets a pane have BOTH keyboard avoidance and an
 * auto-hiding header without nesting two scroll views inside each other.
 *
 * Lives in the kit so screens compose it from `@acme/ui` rather than importing
 * the library, matching every other primitive here.
 */
export const KeyboardAwareScroll = css(
  Animated.createAnimatedComponent(KeyboardAwareScrollView),
  'KeyboardAwareScroll',
);

/**
 * A footer that rides the keyboard instead of being buried by it.
 *
 * The scroll view above is the answer for a FORM — it scrolls the focused field
 * into view. A composer is not in a scroll view: it is pinned to the bottom of
 * the screen, so there is nothing to scroll and the keyboard simply covers it.
 * On this app that was literal — the activity declares `adjustResize`, but under
 * edge-to-edge the window is not resized and the app has to consume the IME
 * inset itself, so a child typing an answer could not see what they were typing.
 *
 * It translates ONE element rather than recomputing the whole screen's flex
 * layout, which is also why the scroll view above is the wrong tool here: that
 * one exists to scroll a focused field into view inside a form, and a pinned
 * footer has nothing to scroll. Left at its default zero `offset`, so the bar
 * sits ON the keyboard the way every chat composer does.
 */
export const KeyboardSticky = KeyboardStickyView;
