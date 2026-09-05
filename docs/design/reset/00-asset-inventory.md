# Design reset — asset inventory

Baseline taken 2026-09-05 on `design/reset-v2` at `cdcf4cf`. Counts come from a `find` over the tree excluding `node_modules` and `.git`, matching png/jpg/jpeg/svg/webp/avif/gif/glb/gltf/usdz.

## Totals

231 media files. Where they are:

| Area | Files | What they are |
|---|---|---|
| `apps/web-vite` | 124 | 36 marketing photograph renditions in `public/images` (6 photographs × avif/webp/jpg × 2 widths), 7 source JPEGs in `data/photography`, 1 globe model, 2 icons, and 78 duplicates under `.output/public` and `.vercel/output` build artefacts |
| `apps/mobile` | 26 | 5 Expo icons/splashes in `assets/images`, 15 Android launcher mipmaps, 4 iOS appicon/splash imageset entries, 2 vendored dav1d Pod logos |
| `docs/site` | 24 | documentation figures, not shipped |
| `apps/web` | 17 | Next.js app icons and static art |
| `.agents/skills` | 12 | agent tooling, not product |
| `packages/avatar` | 11 | Natalie's 3D assets — see below |
| `audit/motion` | 10 | motion before/after captures |
| `apps/storybook` | 4 | Storybook static |
| `apps/admin-vite` | 3 | admin icons |
| `packages/ui` | **0** | the kit ships no artwork |

## Product artwork that exists

**Natalie, `packages/avatar/assets/`** — a rigged, textured character, not a placeholder.

| File | Size |
|---|---|
| `natalie-phone/natalie.gltf` + 8 PBR maps (baseColor ×2, metallicRoughness ×2, normal ×2, specular ×2) | 13 MB total |
| `humano-marketing.glb` | 12 MB |
| `humano-marketing-source.glb` | 70 MB |
| `avatar-manifest.json`, `lash-strands.json` | 12 KB |

The 70 MB source GLB is a build input and must never ship. Whether the 12 MB marketing GLB and the 13 MB phone set are inside ADR-114's preload budget is unverified here — measure before the Today art budget is set.

**Marketing photography, `apps/web-vite`** — 6 photographs, all Pexels licensed, all with recorded provenance:

`hero-kitchen-table` (8055131) · `parents-homework` (5905842) · `schools-operations` (7654178) · `schools-instruction` (37476309) · `schools-educator` (8423069) · `schools-classroom` (5212703).

`data/photography` holds 7 source JPEGs. `8618018.jpg` matches no entry in `photography.ts` and ships nowhere — either it is a rejected pick that was never deleted, or an entry was dropped. Resolve before the register is treated as complete.

Provenance is already systematic. `src/components/photography.ts` carries the runtime half (crop, emitted widths, alt string); `src/components/photography.provenance.ts` carries Pexels id, photographer, source URL, what the frame depicts, casting rationale, and the surface that mounts it; `scripts/build-photography.mjs` generates `public/images/MANIFEST.md` from both. The two halves are held together by `satisfies Record<PhotoName, …>`, so adding a photograph without its provenance is a compile error.

`packages/art/registry.ts` should copy this design rather than invent a second one. The split exists for a measured reason: casting prose in the runtime object ships to every reader and does not tree-shake.

## What is missing, by art class

| Art class | Needed for | Present today |
|---|---|---|
| Cut-paper scenes | Learner Today K–2, K–2 completion | none |
| Subject objects (per subject × skill) | Learner Today 3–12 hero cards, `MissionPath` nodes | none |
| Manipulatives — fraction tiles, base-ten blocks, number lines, area models | Tutor Room canvas, 3–5 and 6–8 hero art | none as assets; they are drawn at runtime, so the deliverable is the renderer plus a static PNG fallback exported from Storybook |
| Adult photography | Parent Home, teacher and tutor surfaces, onboarding | 6 photographs exist for marketing; none are wired into any app surface |
| Natalie stills / baked clips | 3D-off fallback per ADR-114 | not verified as present; the GLTF and GLB are, the baked clips are not |
| Empty-state art ("what will appear here") | every empty state on a learner surface | none |

## Budget baseline

Brief §9 sets first-paint art on Today at ≤ 250 KB. For reference, the largest existing single rendition is `schools-operations-1440.jpg` at 169 KB, and its AVIF is 60 KB. A hero at 840px in AVIF costs about 49 KB in the existing set. A Today scene plus one subject object at that treatment fits the budget; Natalie does not and must stay on the ADR-114 preload path with its own budget.

## First registry job — done

`packages/art/registry.ts` now exists, modelled on the `photography.ts` / `photography.provenance.ts` split, with all 6 photographs recorded and their Pexels provenance carried across. `packages/art/registry.assert.ts` states the register's invariants as compile-time assertions:

- the runtime and provenance halves cover the same key set;
- `SceneArtName`, `ObjectArtName` and `FigureArtName` resolve to `never`, so any component that would mount a scene, subject object or Natalie still fails to compile until the first approved asset lands;
- photograph entries are cleared for the `adult` band only.

Verified: `tsc --noEmit --strict` exits 0 on the package. Widening the photo band tuple to admit `k2` fails with one error at `registry.assert.ts:52`, so the casting law is enforced by the compiler rather than by review attention.
