# Globe source data — provenance

<!--
Why the source topojson is vendored rather than fetched at build time, and what
licence it travels under. Read this before replacing the file.
SOT: this file · apps/web-vite/scripts/build-globe-geometry.mjs
SOT-KEYWORDS: globe data provenance natural earth world atlas topojson licence 110m
-->

| Field | Value |
| --- | --- |
| File | `world-atlas-countries-110m.json` (107 761 bytes) |
| Package | [`world-atlas@2.0.2`](https://github.com/topojson/world-atlas) · `countries-110m.json` |
| Fetched from | `https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json` |
| Upstream source | [Natural Earth](https://www.naturalearthdata.com/) `ne_110m_admin_0_countries`, 1:110 m cultural vectors |
| Contents | TopoJSON `Topology`, objects `countries` (177 geometries) and `land`; quantised, `transform.translate[1] = -85.609…` (Web-Mercator clip latitude) |
| Licence | Natural Earth is **public domain** (no permission needed, no attribution required, attribution appreciated). `world-atlas` itself is ISC. |

## Why it is vendored and not downloaded during the build

A build that reaches the network is a build that fails on a plane, in CI without
egress, and on the day jsDelivr has an incident — for a file that changes on the
scale of years. Vendoring makes `pnpm --filter web-vite build` hermetic and makes
the exact bytes of the geometry reviewable in a diff.

The 107 kB source is a **build input only**. It is not in `public/` and is never
served: `scripts/build-globe-geometry.mjs` converts it to the binaries under
`public/globe/` and the client fetches those. `topojson-client` therefore appears
in `devDependencies`-shaped usage only — it never reaches a browser bundle.

## Replacing it

1. Download the new file to this path.
2. Re-run `pnpm --filter web-vite globe:geometry`.
3. Re-run `pnpm --filter web-vite globe:check` — it fails if the committed
   artefacts under `public/globe/` and `src/globe/generated/` no longer match a
   fresh conversion.
4. Re-read the script's `REGIONS` table: it asserts that **every** country in the
   file is assigned a region, so a source with different country ids fails the
   conversion loudly rather than silently dropping land.
