'use client';
// The same entry on web, which opens nothing.
//
// THERE IS NO XR ON WEB. `@reactvision/react-viro` ships no web build of
// `ViroXRSceneNavigator`, the learner and marketing web apps must keep
// building, and a spatial whiteboard behind a browser tab is not the feature.
// This fork exists so the bare specifier resolves everywhere and no web bundler
// ever sees the renderer — the TS-resolution anchor pattern `problem-storage.ts`
// uses for the same reason.
//
// It renders the honest answer rather than an empty view: a child who somehow
// reached this route is told where their board is.
// Mobbin: https://mobbin.com/flows/d7677bb3-36de-4057-945f-66872bd038e4 (Apple Store "View augmented reality" — the coach/status copy is a plain non-modal line, never a blocking dialog) · https://mobbin.com/flows/bef3926b-7c0c-4498-b348-c84321d2085b (adidas — says what is happening while the scene loads, and says where you are going back to). Structure only.
// SOT: packages/app/features/tutor/tutor-xr-entry.native.tsx
// SOT-KEYWORDS: tutor xr entry web no xr unsupported anchor platform fork

import { View } from '@acme/ui/primitives';
import { Text } from '@acme/ui';
import type { TutorXrScreenProps } from './tutor-xr-screen.types.ts';

export function TutorXrEntry({ onExit }: TutorXrScreenProps) {
  void onExit;
  return (
    <View className="flex-1 items-center justify-center bg-surface gap-stack p-group">
      <Text variant="body">The spatial whiteboard needs a headset.</Text>
      <Text variant="caption" tone="muted">
        Your board is on the normal tutor screen, with everything you have written.
      </Text>
    </View>
  );
}
