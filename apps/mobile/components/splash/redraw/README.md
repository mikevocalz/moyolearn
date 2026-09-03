# The Redraw splash

The animated splash as choreographed: ink drawing the logomark on paper, the
two book halves converging on the heart, one heartbeat, the leg ornaments
popping in rhythm, the mark lifting into its lockup, MOYO rising glyph by
glyph under motion blur from the easing's own velocity, LEARN and its dashes
settling, the tagline landing. 3.4s to settled, hand-off at 3.9s.

`moyo-splash-scene.ts` and `MoyoSplash.tsx` are the AUTHORED files, unchanged,
so they can be diffed against the next source drop. `moyo-paths.ts` here is a
shim: it re-exports the repo's geometry and resolves `BRAND` through the token
palette, rather than committing a second copy of 50KB of traced paths.

## It does not run yet, and exactly one thing is missing

Redraw is a technical preview distributed as `.tgz` tarballs to wcandillon.dev
subscribers — redraw.dev/docs/installation. The `react-native-redraw` package
on public npm is a name placeholder containing nothing.

Everything else is already in place:

| Requirement | State |
|---|---|
| `react-native-webgpu` ≥ 0.5.11 (peer) | 0.9.0, plugin-registered, minSdk 26 — ADR-111 |
| `unplugin-typegpu/babel` | wired in `apps/mobile/babel.config.js` |
| `typegpu` (the `std` in the ink stroke) | 0.12.4 |
| `vendors/` for the `file:` install | created, see its README |
| the scene | here |

Drop the two tarballs into `vendors/`, add the two `file:` dependencies, then
change one import in `../MoyoSplash.tsx` (marked `REDRAW HAND-OFF`).

## Verify against the build you install

The API is marked unstable and the authored file flags six call sites that may
have shifted between preview releases — `path.fit`, `path.segment` + `ctx.t`,
`Paint.setColor` with CSS strings, `new Grain(intensity, seed)`,
`drawPath(..., { grouping: "strand" })`, and `Feather.sweep`. Each is used in
one place and each is a one-line fix; the authored README (kept with the source
drop) explains what to change if a signature differs.
