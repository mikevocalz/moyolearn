// Morph channels present in the bundled native XR model (not the web rig).
// SOT: packages/avatar/assets/natalie-viro.glb · natalie-viro-targets.test.ts
// SOT-KEYWORDS: natalie viro asset morph contract speech face
export const NATALIE_VIRO_TARGETS = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen',
  'mouthFunnel', 'mouthSmileLeft', 'mouthSmileRight',
] as const;
export function viroFace(shape: Readonly<Record<string, number>>) {
  return Object.fromEntries(NATALIE_VIRO_TARGETS.map((name) => [name, shape[name] ?? 0]));
}
