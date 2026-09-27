// Map a visionOS spatial pen tip into the XR board's existing pointer stream.
// The board owns stroke state, so controller and pen input cannot steal each other's line.
// SOT: XrBoardSurface.native.tsx · board-pointer.ts · surface-drag.ts
// SOT-KEYWORDS: muse spatial stylus visionos board ink pointer projection pressure

import { BoardPointer } from './board-pointer.ts';
import { xrSurfaceLocal, type XrDragPlane } from './surface-drag.ts';
import type { XrSurfaceInput, XrVector3 } from './XrPanel.types.ts';

export const SPATIAL_STYLUS_SOURCE = -1000;
const CONTACT_METRES = 0.03;

export interface SpatialStylusFrame {
  tracked: boolean;
  position: XrVector3 | null;
  headPosition: XrVector3 | null;
  tipPressed: boolean;
  primaryPressed: boolean;
  secondaryPressed: boolean;
  pressure: number;
}

export interface SpatialBoardGeometry {
  position: XrVector3;
  yawDeg: number;
  width: number;
  height: number;
  plane: XrDragPlane;
}

type BoardHit = Pick<XrSurfaceInput, 'u' | 'v' | 'pressure'>;
const dot = (a: XrVector3, b: XrVector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const diff = (a: XrVector3, b: XrVector3): [number, number, number] =>
  [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const finite = (point: XrVector3) => point.length === 3 && point.every(Number.isFinite);

function onPaper(tip: XrVector3, board: SpatialBoardGeometry): boolean {
  return Math.abs(dot(diff(tip, board.plane.planePoint), board.plane.planeNormal)) <= CONTACT_METRES;
}

/**
 * The tip touches a reachable panel directly. For a floating panel, the primary
 * side button draws along the head-through-tip ray, like Viro's hand pointer.
 * Only a forward intersection with the actual board plane can produce ink.
 */
export function spatialStylusHit(
  frame: SpatialStylusFrame,
  board: SpatialBoardGeometry,
): BoardHit | null {
  const tip = frame.position;
  if (!frame.tracked || !tip || !finite(tip)) return null;
  const { planePoint, planeNormal } = board.plane;
  let point: XrVector3;
  const distance = dot(diff(tip, planePoint), planeNormal);
  if (Math.abs(distance) <= CONTACT_METRES) {
    point = [
      tip[0] - distance * planeNormal[0],
      tip[1] - distance * planeNormal[1],
      tip[2] - distance * planeNormal[2],
    ];
  } else {
    const head = frame.headPosition;
    if (!frame.primaryPressed || !head || !finite(head)) return null;
    const ray = diff(tip, head);
    const denominator = dot(ray, planeNormal);
    if (Math.abs(denominator) < 1e-6) return null;
    const t = dot(diff(planePoint, head), planeNormal) / denominator;
    if (!Number.isFinite(t) || t <= 0) return null;
    point = [head[0] + ray[0] * t, head[1] + ray[1] * t, head[2] + ray[2] * t];
  }
  const local = xrSurfaceLocal(point, board.position, board.yawDeg, 1);
  const u = local.x / board.width + 0.5;
  const v = 0.5 - local.y / board.height;
  if (![u, v].every(Number.isFinite) || u < 0 || u > 1 || v < 0 || v > 1) return null;
  const pressure = Number.isFinite(frame.pressure)
    ? Math.min(1, Math.max(0.05, frame.pressure))
    : 1;
  return { u, v, pressure };
}

/** A held side button stays one stroke until release, exit, or tracking loss. */
export class SpatialStylusBoardInput {
  private held = false;
  private blocked = false;
  private lastPressure = 1;

  constructor(private readonly pointer: BoardPointer) {}

  handle(frame: SpatialStylusFrame, board: SpatialBoardGeometry): XrSurfaceInput | null {
    if (!frame?.tracked || !frame.position || !finite(frame.position)) return this.reset();

    const touching = onPaper(frame.position, board);
    const pressed = frame.primaryPressed || (frame.tipPressed && touching);
    if (!pressed) {
      this.held = false;
      this.blocked = false;
      return this.pointer.finish(SPATIAL_STYLUS_SOURCE);
    }

    const hit = spatialStylusHit(frame, board);
    if (!this.held) {
      this.held = true;
      if (!hit || this.pointer.active) {
        this.blocked = true;
        return null;
      }
      const began = this.pointer.begin({ u: hit.u, v: hit.v, source: SPATIAL_STYLUS_SOURCE });
      if (!began) {
        this.blocked = true;
        return null;
      }
      this.lastPressure = hit.pressure ?? 1;
      return { ...began, pressure: this.lastPressure };
    }

    if (this.blocked || !this.pointer.owns(SPATIAL_STYLUS_SOURCE)) return null;
    if (!hit) {
      this.blocked = true;
      return this.pointer.finish(SPATIAL_STYLUS_SOURCE);
    }
    const moved = this.pointer.move({ u: hit.u, v: hit.v, source: SPATIAL_STYLUS_SOURCE });
    if (moved?.phase === 'end') this.blocked = true;
    this.lastPressure = hit.pressure ?? this.lastPressure;
    return moved ? { ...moved, pressure: this.lastPressure } : null;
  }

  reset(): XrSurfaceInput | null {
    this.held = false;
    this.blocked = false;
    return this.pointer.finish(SPATIAL_STYLUS_SOURCE, true);
  }
}
