---
name: avatar-materials
description: Natalie's surface — skin, hair, eyes, lashes, mouth interior, lighting and tone mapping — and keeping her the same person on every platform. Use this whenever rendering, materials, shaders, lighting or a device tier is touched, and whenever someone says she looks flat, plasticky, waxy, or different on one platform than another. It owns identity across marketing, app web, native and XR.
---

# Avatar materials

Identity is a rendering property before it is an art property. The same
geometry under two material paths is two different people, and a child who meets
one on the marketing site and the other in the app has met a stranger twice.

## What the assets author

Both shipped assets carry `KHR_materials_specular`, `KHR_materials_ior` and
`KHR_materials_anisotropy` — see `rig-manifest.json`. The marketing GLB adds
`EXT_texture_webp`. So specular tint, index of refraction and the anisotropic
hair sheen are **authored**, and the web scene renders them.

## Do not re-enable the extensions on device

This is the part a materials pass gets wrong, and the repo already paid for the
answer. `tutor-avatar-3d.native.tsx` rebuilds every skinned material as a plain
`MeshStandardMaterial` at load, keeping colour, normal and roughness and
dropping the rest. Read the comment on `simplifyMaterialsForDawn` before
proposing anything — it carries the measured reason and the bisect:
`GLTFLoader` builds a `MeshPhysicalMaterial` for those extensions, three's
WebGPU node graph for that material makes Dawn throw on the first render, and
the surface goes black. `MeshNormalMaterial` rendered correctly, colour-only
rendered, colour + normal + roughness renders — only the extension path fails.

So the ceiling on device is stated, not hidden: specular tint, anisotropic hair
sheen and IOR are gone, and the hair reads flatter than it does on the web.

**The fix is not to put the extensions back.** It is `@acme/avatar/body`'s own
hair and skin materials, written in TSL for this renderer. Never re-enable an
extension without checking the shader the renderer actually generates — a green
typecheck says nothing about what Dawn will do with the node graph.

## Validate the surface separately from motion

A moving avatar hides material problems and a still one exposes them. Capture
each of skin, hair, eyes (cornea and tear line), lashes, mouth interior,
lighting and tone mapping on a held pose, per platform, and compare side by
side. Identity is judged on stills; performance is judged on video. Mixing the
two is how a hair problem gets diagnosed as an animation problem.

## Tiers drop features, not quality

A capability tier chooses texture size, facial detail, hair and cloth secondary
motion, and resolution. When a device cannot afford a feature, drop the
feature — never scale everything down, which produces a uniformly worse person
rather than a simpler one. A slow device gets a calmer, stable performance; it
never gets a frozen face or catch-up animation.

## Rules

- Same identity in side-by-side stills across marketing, app web, native and XR.
  A difference is a bug even when both look good.
- No extension re-enabled without inspecting the generated shader on the target
  renderer.
- Material work is validated on held poses, not in motion.
- Frame-time p95 inside the tier budget, measured — not eyeballed.

## References

- `references/paths.md` — the per-platform material path and what each drops.
- `packages/avatar/rig-manifest.json` — the authored extensions.
- `packages/app/features/tutor/tutor-avatar-3d.native.tsx` — `simplifyMaterialsForDawn`.
- three.js WebGPU · https://github.com/mrdoob/three.js
- react-native-webgpu · https://github.com/wcandillon/react-native-webgpu
- Callstack react-native-best-practices (frame-time method) · https://github.com/callstackincubator/agent-skills
- Audit §7 · `audit/motion/realism-2026-09-10.md`
