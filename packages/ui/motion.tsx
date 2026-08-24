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

/** Soft rise-and-fade entrance — content blocks, empty states, list headers. */
export const FadeIn = ({ delay = 0, ...props }: MotionPresetProps) => {
  const animated = useAnimated();
  return (
  <MotionView
    key={animated ? 'animated' : 'static'}
    initial={animated ? { y: 12 } : undefined}
    animate={animated ? { y: 0 } : undefined}
    transition={{ type: 'timing', duration: 280, ease: 'easeOut', delay }}
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
