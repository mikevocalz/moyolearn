import { Button } from '@acme/ui';
import { View } from '@acme/ui/primitives';
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
    { mode: 'camera', label: labels.camera, a11y: 'Take a picture of your work' },
    { mode: 'photo-library', label: labels.photoLibrary, a11y: 'Choose a picture from your device' },
    { mode: 'file', label: labels.file, a11y: 'Upload a file' },
    { mode: 'type', label: labels.type, a11y: 'Type the problem' },
    { mode: 'voice', label: labels.voice, a11y: 'Record your voice' },
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
