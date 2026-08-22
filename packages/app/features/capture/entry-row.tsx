import { Button } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { CaptureMode } from './types';

export interface CaptureEntryRowProps {
  value?: CaptureMode;
  onSelect: (mode: CaptureMode) => void;
}

const MODES: { mode: CaptureMode; label: string }[] = [
  { mode: 'camera', label: 'Camera' },
  { mode: 'photo-library', label: 'Photo library' },
  { mode: 'file', label: 'File' },
  { mode: 'type', label: 'Type it' },
  { mode: 'voice', label: 'Say it' },
];

export function CaptureEntryRow({ value, onSelect }: CaptureEntryRowProps) {
  return (
    <View className="w-full gap-stack">
      {MODES.map(({ mode, label }) => (
        <Button
          key={mode}
          title={label}
          variant={value === mode ? 'primary' : 'outline'}
          fullWidth
          onPress={() => onSelect(mode)}
        />
      ))}
    </View>
  );
}
