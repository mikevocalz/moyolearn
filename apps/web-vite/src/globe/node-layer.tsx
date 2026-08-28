'use client';
/**
 * The learning nodes: four hard-shadow cards, each tied to a place on the globe
 * by a leader line.
 *
 * ── PROJECTED DOM, NOT drei `<Html>` ───────────────────────────────────────
 * Three reasons, in order of weight:
 *
 * 1. TEXT CRISPNESS. drei's `<Html transform>` mounts each card in a portal and
 *    drives it with a CSS 3D matrix that includes a per-frame, non-integer
 *    scale. Type under a fractional transform is resampled every frame and
 *    never lands on the pixel grid — on a chapter whose whole aesthetic is
 *    printed matter, that is the one thing that cannot be fuzzy. Here NOTHING
 *    about a card moves: it is parked in a stage corner and only the 2 px
 *    leader line's far endpoint is animated.
 * 2. IT HAS TO WORK WITHOUT A RENDERER. Tier C has no Canvas, so an R3F-only
 *    component cannot own the cards — and the cards are where every claim in
 *    this chapter actually lives. One implementation for all three tiers, not
 *    two that must be kept saying the same thing.
 * 3. STABLE TAB ORDER. Cards that ride the sphere reorder, overlap and
 *    disappear behind the horizon as it turns. A keyboard reader would be
 *    tabbing through a list whose contents depend on the rotation.
 *
 * The layout move is Braintrust's, from `docs/site/mobbin/globe.md`: labels
 * lifted clear of the map and connected down to their territory by long thin
 * leaders, so no label ever sits on top of a landmass.
 *
 * ── The keyboard-focusable list equivalent ─────────────────────────────────
 * This IS the equivalent. It is a real `<ul>` of real `<button>`s in source
 * order, visually part of the composition rather than a duplicate list beneath
 * it, and pressing one turns the globe to that place — the click/tap parity for
 * the drag gesture. Nothing here requires a pointer, and no fact requires
 * reaching the globe: every claim is card text that is always in the DOM.
 *
 * SOT: apps/web-vite/src/globe/nodes.ts · apps/web-vite/src/globe/projection.ts
 *      docs/site/copy-deck.md §5 · docs/site/mobbin/globe.md
 * SOT-KEYWORDS: globe nodes cards leader lines projected dom keyboard list a11y
 *               braintrust anchors reveal phase
 */
import { Button, List, ListItem, Text } from '@acme/ui/primitives';
import { useEffect, useRef } from 'react';
import { globeApi } from './api';
import {
  DEFAULT_TILT,
  DEFAULT_YAW,
  revealedNodeCount,
  useGlobeStore,
} from './globe-store';
import { GLOBE_NODES, type NodeCorner } from './nodes';
import { GLOBE_SCREEN_FRACTION, projectAnchor } from './projection';

/**
 * Where each card's leader line starts, in percent of the square frame. These
 * sit just inside the card corners `globe.css` parks the cards at; the exact
 * point is art direction, and putting it here rather than measuring the card
 * every frame keeps the whole loop free of layout reads.
 */
const LEADER_ORIGIN: Record<NodeCorner, readonly [number, number]> = {
  'top-start': [15, 22],
  'top-end': [85, 22],
  'bottom-start': [15, 78],
  'bottom-end': [85, 78],
};

/**
 * Titles are copy-deck strings and some already end in a full stop ("English
 * today. Spanish next."). Composing an accessible name around them naively
 * produces "…Spanish next.. Turn the globe to Spain.", which a screen reader
 * reads as a stutter. One sentence terminator, wherever the copy put it.
 */
const sentence = (text: string): string => text.replace(/[.!?]+$/, '');

/** Disc radius as a percentage of the square frame. */
const DISC_PERCENT = GLOBE_SCREEN_FRACTION * 100;

/**
 * How fast a leader fades out as its anchor approaches the limb. Multiplying
 * depth by 4 means the line is gone by the time the anchor is within ~15° of
 * the horizon, where the endpoint would otherwise crawl along the edge and the
 * line would read as pointing at nothing.
 */
const LIMB_FADE = 4;

export interface NodeLayerProps {
  /**
   * True on the WebGL tiers. False on Tier C, whose globe is a print baked at
   * the default rotation: the leaders are drawn once and the cards highlight
   * rather than turn anything.
   */
  readonly interactive: boolean;
}

export function NodeLayer({ interactive }: NodeLayerProps) {
  const revealed = useGlobeStore((state) =>
    revealedNodeCount({ phase: state.phase, nodeCount: state.nodeCount }),
  );
  const activeNode = useGlobeStore((state) => state.activeNode);
  const setNodeCount = useGlobeStore((state) => state.setNodeCount);

  const leaders = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    setNodeCount(GLOBE_NODES.length);
  }, [setNodeCount]);

  useEffect(() => {
    const paint = (yaw: number, tilt: number) => {
      GLOBE_NODES.forEach((node, index) => {
        const group = leaders.current[index];
        if (!group) return;
        const anchor = projectAnchor(node.anchor[0], node.anchor[1], yaw, tilt);
        const opacity = Math.min(1, Math.max(0, anchor.z * LIMB_FADE));
        group.setAttribute('opacity', opacity.toFixed(3));
        if (opacity === 0) return;
        const x = 50 + anchor.x * DISC_PERCENT;
        const y = 50 - anchor.y * DISC_PERCENT;
        const line = group.firstElementChild;
        const dot = group.lastElementChild;
        line?.setAttribute('x2', x.toFixed(2));
        line?.setAttribute('y2', y.toFixed(2));
        dot?.setAttribute('cx', x.toFixed(2));
        dot?.setAttribute('cy', y.toFixed(2));
      });
    };

    if (!interactive) {
      // Tier C: the SVG globe is baked at exactly these angles by
      // `build-globe-geometry.mjs`, so one pass is the whole job.
      paint(DEFAULT_YAW, DEFAULT_TILT);
      return;
    }

    /*
      Repaint is subscription-driven and coalesced into one rAF, NOT a
      free-running loop. `tick()` writes yaw once per rendered frame, so this
      fires exactly as often as there is something new to draw and stops dead
      when the globe is at rest — which matters most on the machines that are
      already close to a tier demotion.
    */
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const state = useGlobeStore.getState();
        paint(state.yaw, state.tilt);
      });
    };
    schedule();
    const unsubscribe = useGlobeStore.subscribe(schedule);
    return () => {
      unsubscribe();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [interactive]);

  return (
    <>
      <svg
        className="moyo-globe-leaders"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {GLOBE_NODES.map((node, index) => {
          const [ox, oy] = LEADER_ORIGIN[node.corner];
          return (
            <g
              key={node.id}
              ref={(element) => {
                leaders.current[index] = element;
              }}
              opacity={0}
            >
              <line
                x1={ox}
                y1={oy}
                x2={ox}
                y2={oy}
                stroke="var(--color-moyo-outline)"
                strokeWidth={2}
                // The frame is square so the viewBox transform is uniform, but
                // a literal 2px rule is the point: the leader is a drawn line,
                // not a shape that thickens with the stage.
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={ox}
                cy={oy}
                r={1.1}
                fill="var(--color-moyo-heart)"
                stroke="var(--color-moyo-outline)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      <List className="moyo-globe-nodes">
        {GLOBE_NODES.map((node, index) => {
          const isRevealed = index < revealed;
          const isActive = activeNode === node.id;
          return (
            <ListItem
              key={node.id}
              className={`moyo-globe-node moyo-globe-node--${node.corner}${
                isRevealed ? '' : ' moyo-globe-node--hidden'
              }`}
            >
              <Button
                onPress={() => globeApi.focusNode(isActive ? null : node.id)}
                aria-label={
                  interactive
                    ? `${sentence(node.title)}. Turn the globe to ${node.anchorName}.`
                    : `${sentence(node.title)}. Marked on the map at ${node.anchorName}.`
                }
                className={
                  'w-full items-start gap-element rounded-moyo-card border-moyo-rule border-moyo-outline bg-moyo-paper-raised p-inset text-left ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
                  (isActive ? 'shadow-moyo-3' : 'shadow-moyo-2')
                }
              >
                <Text className="text-site-label uppercase text-moyo-secondary">{node.title}</Text>
                <Text className="text-site-body text-moyo-ink">{node.body}</Text>
              </Button>
            </ListItem>
          );
        })}
      </List>
    </>
  );
}
