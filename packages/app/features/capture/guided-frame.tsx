// GuidedFrame — web fallback for the live camera view.
// The native fork lives in ./guided-frame.native.tsx; web uses the
// file-picker entry path instead of the live viewfinder.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture web fallback age band

import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { AgeBand } from './age-band';
import type { CapturePhoto } from './types';

export interface GuidedFrameProps {
  ageBand?: AgeBand;
  onCapture: (photo: CapturePhoto) => void;
}

export function GuidedFrame({ ageBand }: GuidedFrameProps) {
  const copy =
    ageBand === 'young'
      ? 'Camera preview is only in the app. Ask a grown-up to help.'
      : 'Camera preview is only available in the app.';
  return (
    <View className="flex-1 items-center justify-center p-inset">
      <Text className="font-sans text-body text-text text-center">{copy}</Text>
    </View>
  );
}
