# Material paths, per platform

| Platform | Renderer | Material | Authored extensions honoured |
|---|---|---|---|
| Marketing (`apps/web-vite`) | three.js WebGL/WebGPU | as authored | specular, IOR, anisotropy |
| App web (`tutor-avatar-3d.web.tsx`) | `THREE.WebGPURenderer`, WebGL2 fallback | as authored | specular, IOR, anisotropy |
| Native (`tutor-avatar-3d.native.tsx`) | WebGPU via Dawn | `MeshStandardMaterial`, rebuilt at load | **none** — colour, normal, roughness only |

## Why native differs

`simplifyMaterialsForDawn` records it: three's WebGPU node graph for
`MeshPhysicalMaterial` makes Dawn throw on the first render, every frame, behind
a black surface. The bisect is in that comment and is worth keeping — normal
material rendered, colour-only rendered, colour + normal + roughness renders,
only the extension path fails.

## The consequence, stated

Hair is the visible loss. Anisotropy is what gives it directional sheen, so on
device it reads flatter than on the web. That is a known, recorded ceiling — not
a bug to file and not something to fix by re-enabling the extension.

The route out is `@acme/avatar/body`'s TSL hair and skin materials, written for
this renderer.

## Not measured

No side-by-side identity capture exists for this branch. No frame-time p95 per
tier has been recorded. Both are this skill's outputs and neither has been
produced — write "not measured" rather than an estimate.
