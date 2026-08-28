'use client';
/**
 * Tier C — the globe with no WebGL at all, and the one the SERVER renders.
 *
 * Not a placeholder and not a screenshot: it is the same continents, from the
 * same Natural Earth source, through the same orthographic projection, resolved
 * at build time into ~18 kB of SVG path data
 * (`scripts/build-globe-geometry.mjs:ringToPath`). Same composition, same
 * colours, same rings, same four anchors — no three, no canvas, no GPU.
 *
 * Because this is what the prerender emits, chapter 04 is real content in the
 * HTML rather than an empty div waiting for a bundle. A crawler and a
 * JS-disabled reader both get the map.
 *
 * ── Why the viewBox is that number ─────────────────────────────────────────
 * `preserveAspectRatio="xMidYMid meet"` scales the viewBox to the SHORTER side
 * of the stage, so a viewBox half-extent of `SILHOUETTE_RADIUS / (2 *
 * GLOBE_SCREEN_FRACTION)` makes the disc land at exactly
 * `globeRadiusPx(width, height)` — the same radius the WebGL camera's zoom
 * produces, and the same one the DOM leader lines are drawn against. That
 * equality is why no JavaScript is needed to size this: it is pure geometry,
 * correct on the server, correct at every viewport.
 *
 * ── Why it is aria-hidden ──────────────────────────────────────────────────
 * Same reason as the canvas. Every claim this picture makes is in the DOM as
 * text — `GLOBE_ALT_TEXT` and the node list — so exposing several hundred
 * `<path>` elements to a screen reader would be noise on top of the real
 * content, not a second way to reach it.
 *
 * SOT: apps/web-vite/src/globe/generated/silhouette.ts
 *      apps/web-vite/src/globe/projection.ts · docs/site/tokens.md §5.1
 * SOT-KEYWORDS: globe tier c static svg silhouette no webgl fallback prerender
 *               orthographic viewbox rings
 */
import { View } from '@acme/ui/primitives';
import { ATMOSPHERE_RINGS, RADIAN } from './composition';
import { SILHOUETTE_PATHS, SILHOUETTE_RADIUS } from './generated/silhouette';
import { GLOBE_SCREEN_FRACTION } from './projection';
import { moyoCustomProperty } from './theme-tokens';

const VIEW_HALF = SILHOUETTE_RADIUS / (2 * GLOBE_SCREEN_FRACTION);
const VIEW_BOX = `${-VIEW_HALF} ${-VIEW_HALF} ${VIEW_HALF * 2} ${VIEW_HALF * 2}`;

/** Coastline stroke, in path units. 8/1000 of the radius ≈ the WebGL slab's edge. */
const COAST_STROKE = 8;
/** The hard offset shadow under the disc, matching `--moyo-shadow-offset-3` in feel. */
const DISC_SHADOW = 26;

/**
 * `fillToken` → the `fill` value. Written as a `var()` and not as a Tailwind
 * class because SVG `fill` is not in the utility set this theme emits, and a
 * hex here would be exactly the raw value `CLAUDE.md` bans. The custom-property
 * name comes from the same helper the WebGL tiers use, so both read the same
 * variable.
 */
function tokenFill(token: string): string {
  return `var(${moyoCustomProperty(token)})`;
}

export function StaticGlobe() {
  return (
    <View className="moyo-globe-layer" aria-hidden>
      <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        {/*
          Rings first, so the opaque disc drawn after them occludes the half
          that passes behind the globe. A tilted ring projects to an ellipse
          with `ry = r * cos(tilt)` under orthographic projection, which is why
          two numbers describe a 3D ring here as exactly as they do in the
          scene.
        */}
        {ATMOSPHERE_RINGS.map((ring) => {
          const radius = ((ring.inner + ring.outer) / 2) * SILHOUETTE_RADIUS;
          const width = (ring.outer - ring.inner) * SILHOUETTE_RADIUS;
          return (
            <ellipse
              key={ring.inner}
              cx={0}
              cy={0}
              rx={radius}
              ry={radius * Math.cos(ring.tiltDeg * RADIAN)}
              transform={`rotate(${ring.rollDeg})`}
              fill="none"
              stroke={tokenFill(ring.token)}
              strokeWidth={width}
            />
          );
        })}

        <circle
          cx={DISC_SHADOW}
          cy={DISC_SHADOW}
          r={SILHOUETTE_RADIUS}
          fill={tokenFill('moyoOutline')}
        />
        <circle
          cx={0}
          cy={0}
          r={SILHOUETTE_RADIUS}
          fill={tokenFill('moyoPrimary')}
          stroke={tokenFill('moyoOutline')}
          strokeWidth={COAST_STROKE * 2}
        />

        {SILHOUETTE_PATHS.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill={tokenFill(path.fillToken)}
            stroke={tokenFill('moyoOutline')}
            strokeWidth={COAST_STROKE}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </View>
  );
}
