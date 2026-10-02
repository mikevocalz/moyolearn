'use client';

/**
 * Build-time SPECS authoring scene for the Tutor Room.
 *
 * This file is deliberately static. It is parsed by the Viro SPECS compiler
 * from mikevocalz/viro#34 and becomes a portable manifest for Lens Studio.
 * React Native does not execute on SPECS.
 *
 * The local ViroSpecsScene marker keeps this file valid on the currently
 * vendored Viro build. Once the public bridge release lands, this marker can be
 * replaced with the exported ViroSpecsScene without changing the child JSX.
 */

import type { ReactNode } from 'react';
import {
  Viro3DObject,
  ViroAnimations,
  ViroNode,
  ViroPolyline,
  ViroText,
} from '@reactvision/react-viro';

ViroAnimations.registerAnimations({
  moyoSpecsTutorPulse: {
    properties: {
      scaleX: 1.04,
      scaleY: 1.04,
      scaleZ: 1.04,
      opacity: 0.92,
    },
    duration: 650,
    easing: 'EaseInEaseOut',
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NATALIE_GLB = require('@acme/avatar/assets/natalie-viro.glb');

function ViroSpecsScene({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Minimal product proof, not a second Tutor Room implementation.
 *
 * The values intentionally mirror the spatial Tutor Room composition: the
 * teaching surface sits 1.5m forward, Natalie stands to the learner's right,
 * and the route/rail visual proves line geometry survives the same source.
 *
 * Live lesson state remains in Moyo's stores. This static source proves that
 * the same Viro primitives can be cross-compiled into the validated SPECS
 * backend before we bind the portable state/action channel.
 */
export function TutorSpecsAuthoringScene() {
  return (
    <ViroSpecsScene>
      <ViroNode viroTag="moyo-specs-root" position={[0, 0, -1.5]}>
        <ViroText
          viroTag="moyo-specs-title"
          text="Moyo Tutor Room"
          position={[0, 0.42, 0]}
          animation={{ name: 'moyoSpecsTutorPulse', run: true, loop: true }}
        />

        <ViroNode
          viroTag="moyo-specs-board"
          position={[0, 0, 0]}
          scale={[1.2, 0.72, 1]}
        >
          <ViroText
            viroTag="moyo-specs-question"
            text="Show your thinking here"
            position={[0, 0.08, 0.01]}
          />
        </ViroNode>

        <ViroNode
          viroTag="moyo-specs-tutor-slot"
          position={[0.86, -0.22, -0.36]}
          rotation={[0, -22, 0]}
        >
          <Viro3DObject
            viroTag="moyo-specs-natalie"
            source={NATALIE_GLB}
            type="GLB"
            scale={[0.82, 0.82, 0.82]}
            onClick={() => undefined}
            onDrag={() => undefined}
          />
        </ViroNode>

        <ViroNode
          viroTag="moyo-specs-reference-panel"
          position={[-0.84, -0.02, -0.22]}
          rotation={[0, 20, 0]}
        >
          <ViroText
            viroTag="moyo-specs-reference-title"
            text="Reference"
            position={[0, 0.12, 0]}
          />
          <ViroText
            viroTag="moyo-specs-reference-copy"
            text="Your lesson context stays with you."
            position={[0, -0.02, 0]}
          />
        </ViroNode>

        <ViroPolyline
          viroTag="moyo-specs-focus-rail"
          points={[
            [-0.48, -0.36, 0.08],
            [0, -0.28, 0.08],
            [0.48, -0.36, 0.08],
          ]}
          thickness={0.008}
          materials="moyoRail"
        />
      </ViroNode>
    </ViroSpecsScene>
  );
}
