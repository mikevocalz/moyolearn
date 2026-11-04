/**
 * The Round 1 workloads of the 2026-10 device pass, drawn identically on the
 * Baseline and Candidate native stacks (viro-external `scripts/device/build-stack.sh`
 * builds both from one app commit).
 *
 *   R1.2 `video`  one 1.6 m ViroVideo at 2 m playing `r12-patches.mp4`: a
 *                 near-black ramp, mid greys and skin-tone patches.
 *   R1.3 `panel`  the kit's `XrRail` at 1.5 m. Its face is `XR_MATERIAL.rail`,
 *                 authored at 90% alpha (`e6`), and its key labels are
 *                 `ViroText`, so the panel is translucent anti-aliased text
 *                 over passthrough without a new material.
 *   R1.5 `multi`  1, 2 or 4 ViroVideo surfaces at once, each with its own
 *                 decoder and its own external texture.
 *
 * The scene uses the session's local origin (y = 0 is head height when the
 * session starts) and places everything once. Nothing moves, follows the head
 * or reacts to input, so frame timing measures the workload and not the
 * placement logic.
 *
 * Followed, not invented: `ViroVideo` with a `require`d clip and `loop`, as
 * `@reactvision/react-viro`'s ViroVideo.d.ts documents; the `XrRail` contract
 * from `packages/ui/xr/XrRail.types.ts`; the route shape (`ViroXRSceneNavigator`
 * + `ViroARScene` + `ViroController`) from `apps/mobile/app/xr-layout-probe.tsx`.
 *
 * SOT: apps/mobile/app/device-validation-probe.tsx · apps/mobile/assets/validation/README.md
 * SOT-KEYWORDS: device validation probe round 1 video patches panel opacity multi surface viro
 */
import React from 'react';
import { ViroARScene, ViroController, ViroNode, ViroVideo } from '@reactvision/react-viro';
import { XrRail, spatialDistance } from '@acme/ui/xr';
import { videoSurfaceLayout, type ValidationProbeRequest } from './device-validation-params';

// Metro requires a static asset reference.
const PATCH_CLIP = require('../../assets/validation/r12-patches.mp4');

const VIDEO_DISTANCE_M = 2;
const SINGLE_VIDEO_WIDTH_M = 1.6;
const MULTI_VIDEO_WIDTH_M = 1;
const PANEL_DISTANCE_M = spatialDistance.comfortableUI.min + 0.25;
const PANEL_WIDTH_M = 0.6;
const PANEL_HEIGHT_M = 0.5;

const noop = () => undefined;

function VideoSurfaces({ count, widthM }: { count: 1 | 2 | 4; widthM: number }) {
  return (
    <>
      {videoSurfaceLayout(count, widthM, VIDEO_DISTANCE_M, 0).map((cell, index) => (
        <ViroVideo
          key={`video-${count}-${index}`}
          source={PATCH_CLIP}
          loop
          muted
          position={cell.position}
          width={cell.width}
          height={cell.height}
          onError={(event) => {
            if (__DEV__) console.warn('[device-validation-probe] video error', index, event.nativeEvent);
          }}
        />
      ))}
    </>
  );
}

function TranslucentPanel() {
  return (
    <ViroNode position={[0, 0, -PANEL_DISTANCE_M]}>
      <XrRail
        width={PANEL_WIDTH_M}
        height={PANEL_HEIGHT_M}
        distanceM={PANEL_DISTANCE_M}
        handsPrimary={false}
        band="child"
        tool="draw"
        ink="black"
        canUndo
        canRedo={false}
        asking={false}
        onTool={noop}
        onInk={noop}
        onUndo={noop}
        onRedo={noop}
        onAsk={noop}
        onClear={noop}
      />
    </ViroNode>
  );
}

/** One scene per request. The navigator captures it, so the request is fixed for the route's lifetime. */
export function DeviceValidationScene({ request }: { request: ValidationProbeRequest }) {
  return (
    <ViroARScene>
      <ViroController controllerVisibility reticleVisibility={false} />
      {request.workload === 'video' ? <VideoSurfaces count={1} widthM={SINGLE_VIDEO_WIDTH_M} /> : null}
      {request.workload === 'multi' ? <VideoSurfaces count={request.count} widthM={MULTI_VIDEO_WIDTH_M} /> : null}
      {request.workload === 'panel' ? <TranslucentPanel /> : null}
    </ViroARScene>
  );
}
