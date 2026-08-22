// GuidedFrame — web fallback for the live camera view.
// The native fork lives in ./guided-frame.native.tsx; web uses the
// file-picker entry path instead of the live viewfinder.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture web fallback

import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { CapturePhoto } from './types';

export interface GuidedFrameProps {
  onCapture: (photo: CapturePhoto) => void;
}

export function GuidedFrame(_props: GuidedFrameProps) {
  return (
    <View className="flex-1 items-center justify-center p-inset">
      <Text className="font-sans text-body text-text">Camera preview is only available in the app.</Text>
    </View>
  );
}
