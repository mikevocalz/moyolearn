'use client';
// The spatial screen's loader — the only thing that names the Viro module.
//
// `import()` rather than a static import, for the reason `natalie-3d.tsx`
// already established for the 3D avatar: a headset feature must not be part of
// what a child's phone evaluates while their homework screen is starting. The
// renderer is fetched when a board is actually opened in space, and never on
// any other path.
//
// The `.native` fork is where the import lives so that no web bundle resolves
// `@reactvision/react-viro` at all — see `tutor-xr-entry.tsx`.
// SOT: packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: tutor xr entry lazy loader native viro suspense route boundary

import { Suspense, lazy } from 'react';
import { View } from '@acme/ui/primitives';
import { Text } from '@acme/ui';
import type { TutorXrScreenProps } from './tutor-xr-screen.types.ts';

const TutorXrScreen = lazy(async () => ({
  default: (await import('./tutor-xr-screen.native.tsx')).TutorXrScreen,
}));

export function TutorXrEntry(props: TutorXrScreenProps) {
  return (
    <Suspense
      fallback={
        /*
          Words, not a spinner alone. The wait here is a renderer being fetched,
          which is the one moment a child is looking at nothing and does not
          know whether their board survived the trip.
        */
        <View className="flex-1 items-center justify-center bg-surface gap-stack p-group">
          <Text variant="body">Opening your board in space…</Text>
          <Text variant="caption" tone="muted">
            Your working is saved. Nothing is lost if you go back.
          </Text>
        </View>
      }
    >
      <TutorXrScreen {...props} />
    </Suspense>
  );
}
