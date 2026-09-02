// GuidedFrame — web fallback for the live camera view.
// The native fork lives in ./guided-frame.native.tsx; web uses the
// file-picker entry path instead of the live viewfinder.
//
// DECISION: the entry row keeps offering "Take photo" on web and THIS state
// owns the recovery, rather than hiding the camera entry behind a web fork of
// entry-row. The contract's permission failure path is the precedent
// (design/screens/learner/learner.capture/contract.md): when the camera cannot
// run, offer the other doors IN PLACE. Web's real door is upload, so this
// surface hands the learner straight to it — no dead end, and no forked entry
// row to drift out of step.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture web fallback age band upload exit

import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';
import type { CapturePhoto } from './types';

export interface GuidedFrameProps {
  ageBand?: AgeBand;
  onCapture: (photo: CapturePhoto) => void;
  /** Exit for platforms with no viewfinder: jump to the photo-upload path. */
  onPickPhoto?: () => void;
  /** Exit for platforms with no viewfinder: back to "choose how to share". */
  onBack?: () => void;
}

export function GuidedFrame({ ageBand = 'teen', onPickPhoto, onBack }: GuidedFrameProps) {
  const size = buttonSizeForBand(ageBand);
  const copy =
    ageBand === 'young'
      ? 'The camera only works in the app. You can upload a photo here.'
      : 'Camera preview is only available in the app — upload a photo instead.';
  return (
    <View className="flex-1 items-center justify-center gap-stack p-inset">
      <Text className="font-sans text-body text-text text-center">{copy}</Text>
      {onPickPhoto ? (
        <Button
          title={ageBand === 'young' ? 'Upload a photo' : 'Upload a photo instead'}
          variant="highlighter"
          size={size}
          fullWidth
          onPress={onPickPhoto}
          aria-label="Upload a photo of your work"
        />
      ) : null}
      {onBack ? (
        <Button
          title="Go back"
          variant="outline"
          size={size}
          fullWidth
          onPress={onBack}
          aria-label="Go back and choose another way"
        />
      ) : null}
    </View>
  );
}
