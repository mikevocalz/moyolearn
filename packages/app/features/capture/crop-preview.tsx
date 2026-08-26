// CropPreview — web fallback. Native cropping lives in ./crop-preview.native.tsx.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: crop preview web fallback age band

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
