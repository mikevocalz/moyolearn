'use client';

import {
  Viro3DObject,
  ViroARScene,
  ViroNode,
  ViroPolyline,
  ViroText,
} from '@reactvision/react-viro';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NATALIE_GLB = require('@acme/avatar/assets/natalie-viro.glb');

export const MOYO_SPECS_NATALIE_ASSET_ID = 'moyo:tutor:natalie';
export const MOYO_SPECS_ROUTE_POINTS = [
  [-0.34, -0.30, 0.12],
  [0, -0.08, 0.12],
  [0.34, -0.16, 0.12],
] as const;

export interface MoyoSpecsPlatformLabProps {
  onSelect?: () => void;
  onNatalieDrag?: (position: [number, number, number]) => void;
}

/**
 * A deliberately small, one-source Viro scene used as Moyo's cross-backend
 * smoke test.
 *
 * It contains only components covered by Viro's portable SPECS compiler:
 * ViroARScene, ViroNode, ViroText, Viro3DObject and ViroPolyline.
 *
 * The exact same element tree can render through ViroCore on Quest/PICO/
 * visionOS and compile to the Lens Studio/SPECS backend. Product state,
 * tutoring logic and voice stay outside this renderer proof.
 */
export function MoyoSpecsPlatformLabScene({
  onSelect,
  onNatalieDrag,
}: MoyoSpecsPlatformLabProps = {}) {
  return (
    <ViroARScene>
      <ViroNode viroTag="moyo-specs-root" position={[0, 0, -1.5]}>
        <ViroText
          viroTag="moyo-specs-title"
          text="Moyo Spatial Tutor"
          position={[0, 0.32, 0]}
        />

        <ViroText
          viroTag="moyo-specs-prompt"
          text="Show me how you would solve 2x + 3 = 11."
          position={[0, 0.20, 0]}
        />

        <Viro3DObject
          viroTag="moyo-specs-natalie"
          source={NATALIE_GLB}
          type="GLB"
          position={[-0.24, -0.10, 0]}
          scale={[0.18, 0.18, 0.18]}
          dragType="FixedDistance"
          onDrag={(position: [number, number, number]) => {
            onNatalieDrag?.(position);
          }}
        />

        <ViroNode
          viroTag="moyo-specs-ask"
          position={[0.26, -0.16, 0]}
          onClick={() => onSelect?.()}
        >
          <ViroText
            viroTag="moyo-specs-ask-label"
            text="Ask Natalie"
          />
        </ViroNode>

        <ViroPolyline
          viroTag="moyo-specs-working-line"
          points={MOYO_SPECS_ROUTE_POINTS.map((point) => [...point])}
          thickness={0.008}
        />
      </ViroNode>
    </ViroARScene>
  );
}
