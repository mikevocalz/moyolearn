// Local mirrors of Meta's SpatialWindow prop types, so app code never imports the SDK's Flow-typed .d.ts.
// SOT: node_modules/@metavr/layout-window-compat/SpatialWindowProps.d.ts · SpatialAnchor.d.ts
// SOT-KEYWORDS: spatial window meta layout types anchor placement
/**
 * Structural mirrors of the `@metavr/layout-window-compat` 1.0.0 public types
 * this app passes to `<SpatialWindow>`. Typed here so nothing outside
 * `metaWindows.ts` imports the SDK: Meta's `.d.ts` files are Flow-generated
 * and type `children` as Flow's `Node`. Same shapes as Harlem Might's
 * `@viro-external/meta-layout` mirror; keep them 1:1 with Meta's.
 */

/** `SpatialAnchor.d.ts` `AnchorHorizontal`. `start`/`end` mirror in RTL, `left`/`right` never do. */
export type MetaAnchorHorizontal = 'start' | 'end' | 'left' | 'right';

/** `SpatialAnchor.d.ts` `AnchorVertical`. */
export type MetaAnchorVertical = 'top' | 'bottom';

/** `SpatialAnchor.d.ts` `AnchorPoint`. */
export type MetaAnchorPoint =
  | MetaAnchorHorizontal
  | MetaAnchorVertical
  | 'center'
  | Readonly<{ horizontal?: MetaAnchorHorizontal; vertical?: MetaAnchorVertical }>;

/**
 * `SpatialAnchor.d.ts` `AnchorPair`: the point on the main window (`parent`)
 * that the point on this window (`child`) is pinned to, taken literally.
 */
export type MetaAnchorPair = Readonly<{ parent: MetaAnchorPoint; child: MetaAnchorPoint }>;

/** `SpatialOffset.d.ts` `OffsetStepValue`. One step is about 8dp. */
export type MetaOffsetStep = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;

/** `SpatialOffset.d.ts` `Offset`. `+y` is up, `+z` toward the user, `+x` leftward. */
export type MetaOffset = Readonly<{ x?: MetaOffsetStep; y?: MetaOffsetStep; z?: MetaOffsetStep }>;

/** `SpatialWindowStateCache.d.ts` `SpatialWindowPlacement`, from `useSpatialWindowState`. */
export type MetaWindowPlacement = 'inline' | 'spatial' | 'pending' | 'dropped';

/** `SpatialWindowProps.d.ts` `SpatialWindowProps` without `children`. Sizes are dp. */
export type MetaWindowProps = Readonly<{
  label: string;
  windowWidth: number;
  windowHeight: number;
  priority: number;
  promotable: boolean;
  fallback: 'inline' | 'drop';
  anchor: MetaAnchorPoint | MetaAnchorPair;
  /** Absent when the window sits flush with the main window. */
  offset?: MetaOffset;
}>;
