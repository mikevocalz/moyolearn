import { Button } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { buttonSizeForBand, captureLabelsForBand, type AgeBand } from './age-band';
import { CaptureMode } from './types';

export interface CaptureEntryRowProps {
  ageBand?: AgeBand;
  value?: CaptureMode;
  onSelect: (mode: CaptureMode) => void;
}

export function CaptureEntryRow({ ageBand = 'teen', value, onSelect }: CaptureEntryRowProps) {
  const labels = captureLabelsForBand(ageBand);
  const size = buttonSizeForBand(ageBand);

  const modes: { mode: CaptureMode; label: string; a11y: string }[] = [
    { mode: 'camera', label: labels.takePhoto, a11y: 'Take a photo of your work' },
    { mode: 'photo-library', label: labels.choosePhotos, a11y: 'Choose photos from your device' },
    { mode: 'file', label: labels.uploadFile, a11y: 'Upload a PDF or file' },
    { mode: 'type', label: labels.typePaste, a11y: 'Type or paste the problem' },
    { mode: 'voice', label: labels.describeVoice, a11y: 'Describe the work by voice' },
  ];

  return (
    <View className="w-full gap-stack">
      {modes.map(({ mode, label, a11y }) => (
        <Button
          key={mode}
          title={label}
          variant={value === mode ? 'primary' : 'outline'}
          size={size}
          fullWidth
          onPress={() => onSelect(mode)}
          aria-label={a11y}
        />
      ))}
    </View>
  );
}
