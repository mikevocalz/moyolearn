# ADR 002: The globe's geometry, and how it degrades
Status: proposed · Date: 2026-08-28

<!--
Chapter 04's engine: where the continents come from, how they become meshes,
how the border stroke is drawn, and what a machine that cannot render them gets
instead. Written to the `architecture` skill's format; filed under docs/site/
beside ADR-001 because the build spec names that path.
SOT: this file · apps/web-vite/scripts/build-globe-geometry.mjs
     apps/web-vite/src/globe/ · apps/web-vite/src/stores/perf-store.ts
SOT-KEYWORDS: adr globe geometry natural earth topojson build-time extrude outline
              tier performance orthographic silhouette webgl three r3f
-->

## Context

§9 of the build prompt asks for a globe that reads as **a printed, tactile
educational object — a puzzle-piece globe**, not Google Earth: flat colour
blocking in Moyo tokens, Africa in `moyoSun`, oceans in `moyoPrimary`, thick
dark outline strokes, 2–3 hard-edged offset rings, and learning-node cards
anchored to regions. It must come from **real data** (Natural Earth 110m via
world-atlas topojson), be **client-only**, stay under **350 kB gzipped** as a
lazy chunk, and degrade across **three performance tiers** down to a machine
with no usable WebGL at all.

Two constraints from this repo make that harder than it sounds.

**ADR-001 is the thing at risk.** Phase 0's entire value is that
`dist/client/index.html` contains the real `<h1>` and no `<!--$!-->` suspense
marker. TanStack Start prerenders every route through a Node SSR pass. A globe
that touches `three`, `document` or `navigator` during that pass does not
degrade — it throws, React swallows it into a suspense boundary, and the page
silently becomes client-rendered. That failure looks exactly like success in a
browser.

**Tokens are law.** `docs/site/tokens.md` publishes measured contrast ratios —
`moyoOnSun` on `moyoSun` at 9.68:1, `moyoOutline` on every ground — and gates
them in `pnpm lint`. WebGL takes numbers, not class names. Any path that ends in
a hex literal in a scene file makes those published ratios describe a colour
that is no longer on screen.

The pipeline question is therefore not "how do I load a globe" but: **where does
the topojson → mesh conversion happen, and what does the machine that cannot run
the result get instead?**

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A. Build-time conversion to a quantised binary + a build-time SVG fallback** (chosen) | `scripts/build-globe-geometry.mjs` reads a vendored `countries-110m.json`, groups countries into six UN M49 regions, triangulates each polygon, refines it onto the sphere, sweeps a bevelled side wall, and writes two LOD binaries plus a generated TS manifest **and** an orthographic SVG silhouette. The client fetches a `.bin` and uploads it to a `BufferGeometry`. | `node_modules/@types/three/src/extras/ShapeUtils.d.ts:triangulateShape` · `node_modules/topojson-client/src/feature.js:feature` · `node_modules/@types/three/src/core/BufferGeometry.d.ts:addGroup,setIndex` · `node_modules/@types/three/src/core/BufferAttribute.d.ts:Uint16BufferAttribute` | No topojson, no earcut and no 107 kB of source JSON in any bundle. The conversion is reviewable in a diff and reproducible offline. The **same pass** emits the Tier C artwork, so the fallback cannot drift from the real thing. Uint16 + Int16 halve the asset. | A generated artefact can go stale — needs a `--check` gate (added, wired into `pnpm --filter web-vite lint`). Two more committed files. A source-data change is a rebuild, not a refresh. |
| **B. Ship the topojson, convert on the client** | `import countries from '../data/…json'` + `topojson-client.feature()` + earcut in the browser at mount. | same `feature` seam; `topojson-client@3.1.0` is installed | One artefact. Trivially re-tunable. | 107 kB of JSON **plus** the parser **plus** the triangulator in the client bundle, and ~90 ms of main-thread triangulation on the exact devices already being demoted. Worse: the topojson would sit in the first-paint graph unless *also* lazy-loaded, and then Tier C — the tier that never loads three — would have no globe at all. |
| **C. Author a `.glb` in Blender and load it with `GLTFLoader`** | Model the slabs once, export, `useGLTF`. | `three/examples/jsm/loaders/GLTFLoader.js` (present in the installed three) | Full art control. Standard pipeline. | The geometry stops being derived from Natural Earth, so "real data" becomes a claim nobody can re-run. Region ids, centroids and the token→region mapping would live in a binary nobody can diff. A second LOD is a second export by hand. GLTFLoader is ~40 kB the island does not otherwise need. |
| **D. No geometry — a `<canvas>` texture on a sphere** | Render a Natural Earth raster or an SVG-to-canvas map, use it as a `map` texture. | `three` `TextureLoader`/`CanvasTexture` | Cheapest possible mesh. | §9 says **no giant textures ever**, and the whole art direction is *extruded* puzzle pieces — a texture has no silhouette, no edge and no thickness. It also reintroduces colour management: a texture's pixels are not the token, they are a resampling of it. |

### The outline technique, decided separately

The brief asks for a thick dark stroke on continent borders and for the choice
to be cited. Three candidates, in the order they were tried:

| Technique | Why it lost / won |
| --- | --- |
| `EdgesGeometry` + `LineBasicMaterial` | **Cannot be thick.** three.js documents the limit on the property itself: "Due to limitations of the OpenGL Core Profile with the WebGL renderer on most platforms linewidth will always be 1 regardless of the set value." (<https://threejs.org/docs/#api/en/materials/LineBasicMaterial.linewidth>) A one-pixel hairline is the opposite of the brief. `Line2`/`LineMaterial` from `three/addons/lines/` does give screen-space width, at an instanced quad per segment plus ~15 kB of addon. |
| Inverted (backface) hull — `side: THREE.BackSide` on a scaled copy (<https://threejs.org/docs/#api/en/materials/Material.side>) | **Geometrically wrong here.** These slabs are shells centred on the globe's origin, so scaling one about that origin displaces it **radially** — outward, above the top face — not laterally. The "outline" would be a dark disc floating over the continent instead of a ring around its coast. |
| **Bevelled extrusion wall** (chosen) | The border is real edge geometry: the swept side wall of the slab, filled with `moyoOutline` through a second `BufferGeometry` group over the same index buffer. Its thickness is the extrusion depth, so it holds at every angle and every zoom with no second pass and no extra draw call. **The bevel is the load-bearing part**: a straight vertical wall is only visible on coasts whose wall faces the camera, so half of every continent rendered with no outline (observed, screenshotted, fixed). Splaying the *bottom* row outward by 0.8° makes the slab a frustum, so a band of wall shows around the whole coastline from any angle — **at zero extra vertices**, because those vertices already existed. |

## Decision

**Option A**, with the bevelled extrusion wall as the outline.

### The pipeline

`apps/web-vite/scripts/build-globe-geometry.mjs`, run by
`pnpm --filter web-vite globe:geometry` and verified by `globe:check` inside
`pnpm --filter web-vite lint`. Source data is **vendored**
(`data/world-atlas-countries-110m.json`, 107 761 bytes, Natural Earth →
public domain; see `data/PROVENANCE.md`) so the build is hermetic.

Four things in it are not obvious, and each is there because the naive version
is visibly wrong:

1. **Antimeridian unwrap.** Four rings in this file — Fiji, two Russian parts,
   Antarctica — step ±360° in longitude mid-ring. Triangulated as-is they fold
   across the whole map. On a *sphere* no splitting is needed: unwrapping into
   a continuous extended-longitude plane is exact, because longitude → position
   is periodic.
2. **Polar clip repair.** world-atlas is clipped at lat −85.609° (Web
   Mercator's limit, visible as `transform.translate[1]`). Left alone the South
   Pole is a hole with ocean showing through Antarctica.
3. **Densify → triangulate → refine.** A triangle spanning 30° of arc chords
   ~3.4% of the radius *below* the sphere — comparable to the whole extrusion,
   so the Sahara sinks into the ocean. Refinement is a marked-edge (red/green)
   scheme with a shared midpoint cache, so neighbouring triangles agree on
   every midpoint and no T-junction crack can open.
4. **Auto-oriented faces.** Natural Earth is shapefile-derived (clockwise outer
   rings), not GeoJSON right-hand-rule, so `triangulateShape`'s winding is
   measured against each face's own outward radial rather than assumed.

Two decisions cut the asset in half each without touching fidelity:
positions are **Int16-quantised** over ±`TOP_RADIUS` (error 3.2 × 10⁻⁵ radii —
0.01 px at render size) with **Uint16 region-local indices**; and the wall's top
row is **not stored**, because it is already the triangulation's boundary. That
second one also makes a crack between a slab's face and its own border
*geometrically impossible* rather than merely unlikely.

### Orthographic, and why it is architectural

The camera is orthographic. Under orthographic projection a point on the sphere
lands at `centre + (x, −y) · radiusPx` with no perspective divide, so **eight
lines of trigonometry in `src/globe/projection.ts` place all three**: the WebGL
camera, the build-time SVG silhouette, and the DOM leader lines that tie a node
card to its anchor. A perspective camera would have forced the DOM layer to
import three and read a live camera matrix — and would then only work on the
tiers that have a camera. It also flatters a printed object badly: a globe with
foreshortening reads as a photograph of a ball.

### Colour comes from CSS, at runtime

The pipeline emits a token **name** per region (`moyoSun`, `moyoLeaf`, …), never
a colour. `src/globe/theme-tokens.ts` resolves `--color-moyo-sun` off
`document.body` inside `.moyo-site` and hands three the value the stylesheet is
already using. `GlobeFillToken` (generated) is a subset of `MoyoSceneToken`
(hand-written), and TypeScript checks it at every `colors[slice.fillToken]` — a
region whose token nobody reads fails the build instead of rendering black.

To keep the rendered pixel equal to the token there are **no lights anywhere**
(every material is `MeshBasicMaterial`) and tone mapping is `NoToneMapping`
(`flat` on the `<Canvas>`). A Lambert term or an ACES curve would shade the
colours per-pixel and every ratio published in `docs/site/tokens.md` would stop
describing what is on screen. Depth still reads, from three sources that cost no
lighting: the ink side wall, the rings occluding behind the globe, and the hard
offset shadows on the DOM cards.

### The three tiers

Held in **one** `usePerfStore` at `src/stores/perf-store.ts`, shared with the
motion foundation (this file is the resolution of a collision in which
`src/globe/perf-store.ts` and `src/motion/perf-store.ts` both existed).

| | Tier A | Tier B | Tier C |
| --- | --- | --- | --- |
| Geometry | `continents-hi.bin`, **14 889 triangles** | `continents-lo.bin`, **7 378 triangles** | none |
| Renderer DPR | ≤ 1.5 | 1 | — |
| Antialiasing | **off** | off | — |
| Grain pass | fullscreen quad | none | none |
| Ocean sphere | 96 × 64 | 48 × 32 | SVG circle |
| Ring segments | 128 | 64 | 3 SVG ellipses |
| Transfer | 108.6 kB gz | 55.4 kB gz | 9.4 kB gz, already in the JS |

Antialiasing is off on the *capable* tier deliberately, following Stripe's globe
write-up (<https://stripe.com/blog/globe>), which reports that disabling renderer
antialiasing alone materially improved smoothness. The art direction is flat
colour blocking with a 3–4 px ink border; MSAA buys very little against edges
that are already solid ink.

**Detection** is `deviceMemory` + `hardwareConcurrency` + a WebGL2 probe + a
coarse-pointer check, then a 500 ms rAF probe of *real rendered frames* that can
demote A → B (< 45 fps) or B → C (< 24 fps), one way only.

**Tier C is the default and the server's answer.** `tier` starts `null` and
`resolveTier` maps `null` → C, so the prerender emits the static composition and
the client's first render matches it. That is also the mounted gate: `tier` can
only leave `null` from `detect()`, and `detect()` can only be reached from an
effect. `React.lazy(() => import('./scene'))` is the second lock and the dynamic
`import('./geometry')` is the third.

### What was measured

Every number below is from `pnpm --filter web-vite build`, gzip level 9.

| Measurement | Value | Budget |
| --- | --- | --- |
| Lazy island chunk (`three.module` 183.2 + `scene` 49.6 + `geometry` 0.6) | **233.4 kB gz** | < 350 kB gz ✓ |
| `/globe-lab` initial JS, pre-globe | **146.5 kB gz** (+ 12.8 kB CSS) | < 200 kB gz ✓ |
| `/` initial JS (pre-existing, ADR-001's `@acme/ui` barrel) | 194.5 kB gz | < 200 kB gz ✓ |
| `continents-hi.bin` | 145.6 kB raw / **108.6 kB gz** | — |
| `continents-lo.bin` | 73.7 kB raw / **55.4 kB gz** | — |
| Tier C silhouette in the JS + HTML | 21.6 kB raw / **9.4 kB gz** | — |
| Tier A worst case (island + hi geometry) | **342.0 kB gz** | — |
| Prerendered `/globe-lab/index.html` | 36.3 kB, real `<h1>`, **no `<!--$!-->`**, no reference to the three chunk | — |
| Frame probe on the dev machine, Tier A | **120 fps** (reason held at `capable`, no demotion) | — |

LOD tuning was measured, not guessed. Simplification tolerance is the only lever
that reduces triangle count (densification cannot, quantisation only halves
bytes):

| RDP tolerance | Triangles | `hi` binary |
| --- | --- | --- |
| 0.15° | 26 529 | 179.7 kB gz |
| 0.25° | 19 187 | 134.2 kB gz |
| **0.35° (shipped)** | **14 889** | **105.4 kB gz** |
| 0.40° | 13 920 | 98.7 kB gz |

0.35° is ~39 km — one to two pixels at the size this globe renders. Both
0.15° and 0.35° renders were produced and compared side by side; the difference
is below a pixel and the coarser one reads as deliberate stamping, which is the
brief. Halving the tolerance costs 78% more triangles and 74 kB gzipped.

### How the tiers were verified as actually different

Forced from the lab's tier buttons, then read back from the live DOM:

| Forced tier | Canvas | Backing store | Binary fetched | SVG paths |
| --- | --- | --- | --- | --- |
| A | present, 1120 px | 1680 px (**DPR 1.5**) | `continents-hi.bin` | 0 |
| B | present, 1120 px | 1120 px (**DPR 1**) | `continents-lo.bin` | 0 |
| C | **absent** | — | none | 6 |

Reduced motion was verified the same way: with the flag on, `setPhase(0)` is
refused, `phase` stays 1 and all four node cards remain visible. Phase reveal was
verified at 0 / 0.5 / 1 → 0 / 2 / 4 cards.

## Consequences

**Easier**

- Chapter 04 is **real content in the prerendered HTML**: the static globe, all
  four node cards and the text alternative are in `dist/client/globe-lab/index.html`.
  A crawler and a JS-off reader both get the map and the claims.
- The motion agent gets a five-function seam (`docs/site/globe-api.md`) that is
  safe to call at 60 Hz, needs no ref and no mount, and cannot be reached before
  the island exists.
- Changing a palette token changes the globe. There is no second copy of the
  colours to review.
- Adding a region is a row in `REGIONS`; the union types, the manifest and the
  Tier C artwork all follow from it, and the script **fails loudly** if any
  country in the source is unassigned.
- Tier C is not a placeholder, so a WebGL failure at any point — 404, SPA-shell
  HTML, decode mismatch, blocked context — degrades to a complete composition
  instead of a hole.

**Harder / costs**

- **Two generated artefacts can go stale.** Mitigated by `globe:check`, which
  re-runs the conversion into memory and compares bytes; it is in
  `pnpm --filter web-vite lint`. It is a real cost: a pipeline edit that is not
  followed by a regenerate now fails lint.
- **three is 183.2 kB gz of the 233.4 kB island and is not tree-shakeable here.**
  `@react-three/fiber` calls `extend(THREE)` on the whole namespace
  (`dist/react-three-fiber.esm.js:40`), which retains it. Dropping R3F for
  hand-written three would recover perhaps 60 kB and cost the entire component
  model. Not taken.
- **The composition's geometry constants are a coupled pair.**
  `GLOBE_SCREEN_FRACTION` (0.36) × `COMPOSITION_EXTENT` (1.30) = 46.8% of the
  stage's shorter side. Raising either clips the outer ring on a square
  viewport. Both are commented; neither is independently tunable.
- **`react-hooks/immutability` shapes the scene.** The lint rule forbids
  mutating hook returns and props, which rules out the ordinary R3F idioms of
  writing `camera.zoom` and of passing refs down to a driver component. The
  scene is built around that: the pixel scale is a JSX prop, and the frame
  driver owns its own refs. That is a better design and it was not a free choice.
- **A raw `<div>` carries the drag surface.** `@acme/ui/primitives`' `View` is
  react-native-web's View, whose prop types (React Native's `ViewProps`) model
  neither `onPointerDown` nor `onKeyDown`. Every element that carries meaning is
  still a kit primitive; this one has no semantics to lose.
- **`src/globe/globe.css` exists.** Tailwind has no token for "the card sits in
  the top-left quadrant of a square stage", and `left-[8%]` is the arbitrary
  value `CLAUDE.md` bans. Every colour, spacing, shadow, radius and duration in
  that file is a `var()` onto a Moyo token; only pure geometry (percentages,
  `aspect-ratio`, a container-query breakpoint) is literal.
- **French Guiana is a documented special case.** UN M49 files it under France,
  which is Europe, and at 110m it renders on South America. `PART_OVERRIDES`
  reassigns it by lon/lat box + country id, and the script fails if that box
  ever matches other than exactly one polygon part. It is one entry; a second
  would be a smell.
- **No real low-end device was tested.** The tier thresholds are reasoned from
  Chromium's `deviceMemory` buckets and verified by *forcing* each tier, not by
  a phone falling into it. Tier C's trigger on a coarse pointer means a phone
  never reaches WebGL at all, which makes the untested path the safe one — but
  it is untested.

**Follow-ups**

- The motion agent drives `globeApi`; the pinned-scroll choreography, the
  Lenis + ScrollTrigger timeline and the cobalt hand-off into chapter 05 are
  deliberately absent here.
- The chapter's copy (`site.world.backtype`, `.headline`, `.body`,
  `.availability`) belongs to the chapters agent. Only the four node cards ship
  from this work, and only because they are anchored geometry.
- `docs/site/tokens.md` priority action 3 (grain) is now partly discharged: the
  fullscreen quad consumes `--moyo-grain-opacity`. A page-level grain surface for
  the non-globe chapters is still open.
- A per-screen `accessibility-review` on the finished chapter, on device.

## Reversibility

High, and deliberately so.

- **Back to client-side conversion (Option B):** delete the two generated files,
  import the vendored topojson in `geometry.ts` and call the pipeline's own
  functions at runtime. The conversion code is already isolated and pure.
- **Back to a different outline:** the fill and the border are two *groups over
  one index buffer*. Swapping the border technique is a change to
  `buildRegionMesh`'s wall section plus the material array — the top face,
  the manifest, the tiers and the DOM layer are untouched. Setting `BEVEL_DEG`
  to 0 restores a straight wall in one line.
- **Back to no WebGL at all:** force `override: 'C'`. Every claim, every node and
  the whole composition survive, because Tier C is not a fallback bolted on
  afterwards — it is what the server already renders.
- **Irreversible-ish:** the orthographic camera. The DOM leader lines and the
  Tier C silhouette both depend on there being no perspective divide, so moving
  to a perspective camera means rewriting the node layer and regenerating the
  silhouette. That is the one decision here worth arguing about before it ships.

## Constraints honored

Zustand-only — no `useState`/`useReducer` anywhere in `src/globe/`; the mounted
gate is `usePerfStore.tier !== null` and decoded geometry lives in
`useGlobeStore` · tokens-only — no hex, no `px`, no arbitrary Tailwind value;
colours resolve from `--color-moyo-*` at runtime and the pipeline emits token
names · strict TS with no `any` and no `unknown` · no invented APIs — every
three/R3F/topojson symbol was read out of the installed `.d.ts` or source before
it was imported, and each is cited in the Options table and in the file headers ·
no new dependencies; `zustand` and `@types/three` were already in the
`pnpm-workspace.yaml` catalog and were added to `apps/web-vite` as `catalog:` ·
doc references: `CLAUDE.md`, `docs/site/adr-001-ssr-lane.md`,
`docs/site/tokens.md`, `docs/site/copy-deck.md` §5 and §12 F-01,
`docs/site/mobbin/globe.md`, `docs/site/globe-api.md`.
