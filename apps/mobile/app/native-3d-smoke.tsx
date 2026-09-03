/**
 * The deep-linked entry to the native WebGPU smoke harness (ADR-111).
 *
 * `moyo://native-3d-smoke`. Reachable by URL and by nothing else: no tab, no
 * link, no menu item. That is the point — it is engineering evidence, not a
 * product surface, and a child must never be one mis-tap away from a rotating
 * debug cube.
 *
 * The harness is behind `React.lazy` rather than imported directly because
 * `react-native-webgpu` installs its JSI bindings and assigns `navigator.gpu`
 * as a side effect of module evaluation. Expo Router evaluates the modules for
 * routes it mounts, so a static import here would install WebGPU during app
 * boot for every learner. Lazy keeps that cost — and that risk — on this route
 * alone.
 *
 * SOT: qa/walkthroughs/NATIVE-3D-SMOKE-2026-09-03.md
 * SOT-KEYWORDS: native-3d smoke route deep-link webgpu adr-111 lazy
 */
import { Suspense, lazy } from 'react';
import { SafeArea, Text } from '@acme/ui';

const WebGpuSmoke = lazy(async () => ({
  default: (await import('../src/native-3d/webgpu-smoke')).WebGpuSmoke,
}));

export default function NativeThreeDSmokeRoute() {
  return (
    <Suspense
      fallback={
        <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface p-group">
          <Text variant="caption" tone="muted">
            loading the WebGPU harness…
          </Text>
        </SafeArea>
      }
    >
      <WebGpuSmoke />
    </Suspense>
  );
}
