/**
 * Delete the body's inert `COLOR_0` attribute before the renderer sees it.
 *
 * WHAT IS WRONG WITH THE SHIPPED FILE. The authored glTF carries a `COLOR_0`
 * attribute that is every-vertex-white — it changes no pixel. GLTFLoader still
 * sees the attribute and switches `vertexColors` on, and because the primitives
 * are interleaved at `byteStride: 64`, the normalized attribute reaches WebGPU
 * as `unorm32x4`, which the pipeline rejects. A buffer nobody reads was the
 * thing keeping the avatar off the screen.
 *
 * WHY IT IS ONE FUNCTION FOR BOTH RENDERERS. The web fork already did this; the
 * native fork instead rebuilt every material as `MeshStandardMaterial`
 * (`simplifyMaterialsForDawn`), which sidestepped the attribute by never
 * reading it — at the cost of specular tint, anisotropic hair sheen and IOR.
 * ADR-116 recorded that the cheaper fix was UNTESTED against Dawn and must not
 * be assumed. It has now been tested, on a Surface Duo (Android 14 / API 34,
 * Dawn via react-native-webgpu): with the material downgrade removed and this
 * function in its place the stage reached first frame in 5605 ms and the body
 * rendered — hair, skin, garments and all — with no `Exception in HostFunction`.
 * So the downgrade is gone and both forks call this.
 *
 * SOT: docs/decisions/adr-116-native-asset-compression.md
 * SOT-KEYWORDS: gltf vertex colors COLOR_0 interleaved unorm32x4 webgpu dawn native material
 */

import type * as THREE from 'three/webgpu';

/**
 * Strip `COLOR_0` from every skinned mesh under `scene`, and turn the flag the
 * loader set off with it — `vertexColors` left true with the attribute gone
 * makes three look for a `color` varying that no longer has a source.
 */
export function dropInertVertexColors(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.geometry.deleteAttribute('color');
    const material = mesh.material as THREE.Material & { vertexColors?: boolean };
    if (material.vertexColors) material.vertexColors = false;
  });
}
