'use client';
/**
 * Reusable motion primitives (@legendapp/motion) — universal: RN Animated on
 * native, react-native-web's Animated in the browser.
 *
 * - motion(Component): the custom-components pattern from Legend's docs
 *   (createMotionAnimatedComponent) + the kit's className shim — turn ANY
 *   component into a Motion component in one call. The component must accept
 *   a style prop (and forward refs for the native-driver fast path).
 * - MotionView / MotionText: motion versions of the kit's view/text. They sit
 *   on Animated.View/Animated.Text (ref-forwarding, native-driver capable) —
 *   on web these render the same react-native-web elements the tw wrappers
 *   compile to, and MotionText carries tw.Text's default text color.
 * - FadeIn / ScaleIn / SlideUp: entrance presets components compose; pass
 *   `delay` to stagger. Override any Motion prop as needed.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Motion,
  AnimatePresence,
  createMotionComponent,
  createMotionAnimatedComponent,
} from '@legendapp/motion';
import { css } from './html/css';

export { Motion, AnimatePresence, createMotionComponent, createMotionAnimatedComponent };

// SSR safety: server HTML must render CONTENT VISIBLE (no opacity-0 initial
// state — if hydration is slow or fails the page would be blank). Presets
// render statically until hydration, then remount WITH the entrance so the
// animation runs. On native and CSR the snapshot is true from the first
// render: animated immediately, no remount. (External-store read, not state.)
// The same remount carries the Reduce Motion answer, which also arrives late.
const noopSubscribe = () => () => {};
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

type CN = { className?: string };

/** Make a className-capable Motion version of any style-accepting component. */
export function motion<P extends object>(
  Component: React.ComponentType<P>,
  displayName = Component.displayName ?? Component.name ?? 'Component',
) {
  const M = createMotionAnimatedComponent(Component as React.ComponentType<{ style?: unknown }>);
  return css(M as React.ComponentType<object>, `Motion(${displayName})`);
}

export type MotionViewProps = React.ComponentProps<typeof Motion.View> & CN;

export const MotionView = css(
  Motion.View as React.ComponentType<object>,
  'Motion.View',
) as React.FC<MotionViewProps>;

export type MotionTextProps = React.ComponentProps<typeof Motion.Text> & CN;

const MotionTextBase = css(Motion.Text as React.ComponentType<object>, 'Motion.Text');

// Parity with tw.Text: the base-layer default color adapts to the theme;
// explicit text-* classes still override.
export const MotionText = ({ className, ...props }: MotionTextProps) => (
  <MotionTextBase className={`text-body-default ${className ?? ''}`} {...props} />
);
MotionText.displayName = 'CSS(Motion.Text)';

export interface MotionPresetProps extends MotionViewProps {
  /** Delay in ms — stagger sibling entrances. */
  delay?: number;
}

/**
 * Reduce Motion, read once for every preset rather than per call site. CSS
 * `motion-reduce:` cannot reach a JS-driven animation, so a preset that ignored
 * this would keep moving on a device that asked it not to — and the call sites
 * that need it most (S22's celebration stamp) are the ones least likely to
 * remember. Same external-store shape as `useHydrated`: when it reads true the
 * preset renders its final frame statically, which is exactly the "static seal"
 * the child-facing briefs ask for.
 * RNW implements AccessibilityInfo over `prefers-reduced-motion`, so one path
 * covers both platforms.
 */
let reduceMotion = false;
const subscribeReduceMotion = (onChange: () => void) => {
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on: boolean) => {
    reduceMotion = on;
    onChange();
  });
  // The setting's current value is only available asynchronously, so the first
  // paint is unavoidably "motion allowed"; this settles it a tick later.
  void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
    if (on === reduceMotion) return;
    reduceMotion = on;
    onChange();
  });
  return () => sub.remove();
};
export const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduceMotion, () => reduceMotion, () => false);

/** True when an entrance should actually animate. */
const useAnimated = () => {
  const hydrated = useHydrated();
  const reduced = useReducedMotion();
  return hydrated && !reduced;
};

/*
  `easing`, NOT `ease`.

  @legendapp/motion's types accept BOTH (`EaseFunction | ((v:number)=>number)`
  on each), and it resolves the string to an `Easing` function for both — but it
  then spreads the transition straight into `Animated.timing`, which only reads
  `easing`. A resolved `ease` rides along as an unknown key and is dropped, so
  the animation silently falls back to Animated's default `inOut(ease)`.

  Every timing preset in this kit said `ease` and had been running ease-in-out
  since it was written. It is invisible in review — the code says what you meant
  — and only shows up if you sample the transform per frame, which is how it was
  found: the composer's entrance accelerated before it decelerated, where the
  reference decayed monotonically.
*/
/** Soft rise-and-fade entrance — content blocks, empty states, list headers. */
export const FadeIn = ({ delay = 0, ...props }: MotionPresetProps) => {
  const animated = useAnimated();
  return (
  <MotionView
    key={animated ? 'animated' : 'static'}
    initial={animated ? { y: 12 } : undefined}
    animate={animated ? { y: 0 } : undefined}
    transition={{ type: 'timing', duration: 280, easing: 'easeOut', delay }}
    {...props}
  />
  );
};

/** Pop entrance — dialog cards, badges, confirmation moments. */
export const ScaleIn = ({ delay = 0, ...props }: MotionPresetProps) => {
  const animated = useAnimated();
  return (
  <MotionView
    key={animated ? 'animated' : 'static'}
    initial={animated ? { scale: 0.94 } : undefined}
    animate={animated ? { scale: 1 } : undefined}
    transition={{ type: 'spring', damping: 18, stiffness: 260, delay }}
    {...props}
  />
  );
};

/** Docked-surface entrance — toasts, tab-bar accessories, bottom docks. */
export const SlideUp = ({ delay = 0, ...props }: MotionPresetProps) => {
  const animated = useAnimated();
  return (
  <MotionView
    key={animated ? 'animated' : 'static'}
    initial={animated ? { y: 24 } : undefined}
    animate={animated ? { y: 0 } : undefined}
    transition={{ type: 'spring', damping: 20, stiffness: 300, delay }}
    {...props}
  />
  );
};

/**
 * Horizontal entrance — a row ASSEMBLING rather than appearing.
 *
 * Measured off WhatsApp's return from a voice take (frame-by-frame at 30fps,
 * the recording ScreenRecording_08-26-2026 23-02-15). Three things about that
 * transition are worth copying and none of them are obvious from watching it
 * at speed:
 *
 *  - The two states do NOT cross-fade. The recording row is simply gone for one
 *    frame (~33ms) before the composer starts arriving. A dissolve between two
 *    rows of different controls reads as a smear; a cut plus an entrance reads
 *    as a swap.
 *  - The row arrives in two groups that CONVERGE. The trailing keys come in
 *    from the right edge and settle leftward; the leading group comes in from
 *    the left and settles rightward, starting ~100ms later. That counter-motion
 *    is what makes it feel assembled rather than slid.
 *  - Ease-out, no spring. Per-frame travel decayed 21, 16, 10, 4 px — monotonic,
 *    no overshoot. A bounce here would draw the eye to the bar at the exact
 *    moment the child's attention should be going back to the thread.
 */
export interface SlideInProps extends MotionPresetProps {
  /** Which edge the element travels IN from. */
  from?: 'left' | 'right';
  /** Travel distance in px. */
  distance?: number;
  duration?: number;
}

export const SlideIn = ({
  from = 'left',
  distance = 24,
  duration = 200,
  delay = 0,
  ...props
}: SlideInProps) => {
  const animated = useAnimated();
  const offset = from === 'left' ? -distance : distance;
  return (
    <MotionView
      key={animated ? 'animated' : 'static'}
      initial={animated ? { x: offset, opacity: 0 } : undefined}
      animate={animated ? { x: 0, opacity: 1 } : undefined}
      transition={{ type: 'timing', duration, easing: 'easeOut', delay }}
      {...props}
    />
  );
};
