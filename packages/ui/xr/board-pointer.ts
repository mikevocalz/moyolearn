// One controller owns a stroke until release, paper exit, or cancellation.
// SOT: XrBoardSurface.native.tsx · whiteboard.types.ts
// SOT-KEYWORDS: xr pointer ownership lifecycle controller stroke input
import type { XrSurfaceInput } from './XrPanel.types.ts';
type Point = Pick<XrSurfaceInput, 'u' | 'v' | 'source'>;
const finite = (p: Point) => [p.u, p.v, p.source].every(Number.isFinite);
const inside = (p: Point) => finite(p) && p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1;
export class BoardPointer {
  private last: Point | null = null;
  get active() { return this.last !== null; }
  owns(source: number) { return this.last?.source === source; }
  begin(point: Point): XrSurfaceInput | null {
    if (this.last || !inside(point)) return null;
    this.last = point;
    return { ...point, phase: 'begin' };
  }
  move(point: Point): XrSurfaceInput | null {
    if (!this.owns(point.source) || !finite(point)) return null;
    // Keep the valid segment. Never clamp off-paper movement along its edge,
    // and never bridge to a later reentry while the trigger is still held.
    if (!inside(point)) return this.finish(point.source);
    this.last = point;
    return { ...point, phase: 'move' };
  }
  finish(source: number, cancel = false): XrSurfaceInput | null {
    if (!this.owns(source) || !this.last) return null;
    const last = this.last;
    this.last = null;
    return { ...last, phase: cancel ? 'cancel' : 'end' };
  }
  cancel(): XrSurfaceInput | null {
    return this.last ? this.finish(this.last.source, true) : null;
  }
}
