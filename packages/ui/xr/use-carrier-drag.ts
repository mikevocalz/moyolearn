// The hook every draggable XR panel moves its own carrier with.
//
// Bind `bindNode` (as the ref) and `position` to the panel's outermost `ViroNode`, feed the
// grip's report-only `onDrag` into `drag`, and call `grab` / `release` from the
// grip's click states. During the drag the carrier is written natively, so the
// scene does not re-render; `release` commits once. `grabbed` is React state on
// purpose: it flips twice per drag (grab and release), and it is what a panel
// uses to switch its own input off while it is in the hand.
//
// `resetKey` drops the offset (a recenter re-places the panel; an offset kept
// across it would no longer mean "where the child put it beside the board").
// SOT: packages/ui/xr/carrier-drag.ts
// SOT-KEYWORDS: xr carrier drag hook setNativeProps grip release commit panel independent

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { XrVector3 } from './XrPanel.types.ts';
import {
  ZERO_OFFSET,
  carrierDragged,
  carrierGrab,
  carrierPosition,
  carrierReleased,
  type CarrierGrab,
} from './carrier-drag.ts';

/** The one thing the hook needs from the carrier: a native position write. */
export interface CarrierNode {
  setNativeProps(props: { position: [number, number, number] }): void;
}

export interface CarrierDragOptions {
  /** The carrier's position with no drag applied. Default: the origin. */
  base?: XrVector3;
  /** A change drops the committed offset. */
  resetKey?: string | number;
  /** False ignores grip reports (a disabled panel does not move). */
  enabled?: boolean;
  onGrab?(grabbed: boolean): void;
  /** The committed offset, once per drag that moved, with the key it belongs to. */
  onCommit?(offset: XrVector3, resetKey: string | number | undefined): void;
}

export interface CarrierDrag {
  /** Ref callback for the carrier node; stable across renders. */
  bindNode(node: CarrierNode | null): void;
  /** Committed offset only — what the release render derives from. */
  offset: XrVector3;
  /** `base + offset`, for the carrier node's `position` prop. */
  position: [number, number, number];
  grabbed: boolean;
  grab(): void;
  drag(position: readonly number[]): void;
  release(): void;
}

export function useCarrierDrag({
  base = ZERO_OFFSET,
  resetKey,
  enabled = true,
  onGrab,
  onCommit,
}: CarrierDragOptions = {}): CarrierDrag {
  const nodeRef = useRef<CarrierNode | null>(null);
  const [stored, setStored] = useState<{ key: string | number | undefined; offset: XrVector3 }>({
    key: resetKey,
    offset: ZERO_OFFSET,
  });
  const [grabbed, setGrabbed] = useState(false);
  const offset = stored.key === resetKey ? stored.offset : ZERO_OFFSET;

  /* Latest values for callbacks fired by the renderer between renders. */
  const latest = useRef({ base, offset, resetKey, enabled, onGrab, onCommit });
  useLayoutEffect(() => {
    latest.current = { base, offset, resetKey, enabled, onGrab, onCommit };
  });
  const inFlight = useRef<CarrierGrab | null>(null);
  const grabbedRef = useRef(false);
  const keyAtGrab = useRef<string | number | undefined>(resetKey);

  const bindNode = useCallback((node: CarrierNode | null) => {
    nodeRef.current = node;
  }, []);

  const grab = useCallback(() => {
    if (grabbedRef.current) return;
    grabbedRef.current = true;
    inFlight.current = carrierGrab();
    keyAtGrab.current = latest.current.resetKey;
    setGrabbed(true);
    latest.current.onGrab?.(true);
  }, []);

  const drag = useCallback((position: readonly number[]) => {
    const now = latest.current;
    if (!now.enabled) return;
    /* A report with no grab before it (a panel whose grip has no down event)
       starts one silently; `release` still ends it. */
    if (inFlight.current === null || keyAtGrab.current !== now.resetKey) {
      inFlight.current = carrierGrab();
      keyAtGrab.current = now.resetKey;
    }
    const next = carrierDragged(inFlight.current, position);
    inFlight.current = next.grab;
    if (!next.moved) return;
    nodeRef.current?.setNativeProps({ position: carrierPosition(now.base, now.offset, next.grab.live) });
  }, []);

  const release = useCallback(() => {
    const now = latest.current;
    const current = inFlight.current;
    inFlight.current = null;
    if (current !== null && keyAtGrab.current === now.resetKey) {
      const committed = carrierReleased(now.offset, current);
      if (committed !== null) {
        setStored({ key: now.resetKey, offset: committed });
        now.onCommit?.(committed, now.resetKey);
      }
    }
    if (grabbedRef.current) {
      grabbedRef.current = false;
      setGrabbed(false);
      now.onGrab?.(false);
    }
  }, []);

  return { bindNode, offset, position: carrierPosition(base, offset), grabbed, grab, drag, release };
}
