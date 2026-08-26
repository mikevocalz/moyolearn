// CropPreview — web fallback. Native cropping lives in ./crop-preview.native.tsx.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: crop preview web fallback age band
// Mobbin: https://mobbin.com/screens/4883e37b-b8f7-4091-9249-dbf08acad32d (Alta —
//   image fills the frame, the two actions sit in a fixed bar beneath it, never
//   floating over the photo) ·
//   https://mobbin.com/screens/919e832a-9a2f-48d3-bdf7-426df3c3c576 (Google Photos
//   — cancel and confirm at opposite ends, so the destructive one is never
//   adjacent to the one you meant) ·
//   https://mobbin.com/screens/b1bff556-a6a8-4d3b-9e0b-c0b60e9e36c9 (Yazio — a
//   single accented confirm; everything else on the bar stays neutral) ·
//   https://mobbin.com/screens/7a7a2fc9-9663-430d-86d3-47660ceceebf (Apple Photos
//   — corner marks, not a full grid, carry the crop affordance)

import { Button, Image, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface CropPreviewProps {
  ageBand?: AgeBand;
  source: string;
  onCrop: (uri: string) => void;
  onCancel: () => void;
}

export function CropPreview({ ageBand = 'teen', source, onCrop, onCancel }: CropPreviewProps) {
  const buttonSize = buttonSizeForBand(ageBand);

  return (
    <View className="flex-1 gap-stack p-inset">
      <Image alt="Captured work" src={source} className="h-64 w-full rounded-card" />
      <Text className="font-sans text-body text-text text-center">Cropping is only available in the app.</Text>
      <Button
        title="Use this photo"
        variant="highlighter"
        size={buttonSize}
        fullWidth
        onPress={() => onCrop(source)}
        aria-label="Use the full photo"
      />
      <Button title="Retake" variant="outline" size={buttonSize} fullWidth onPress={onCancel} aria-label="Start over" />
    </View>
  );
}
