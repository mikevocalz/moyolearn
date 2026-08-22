import { useState } from 'react';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { CaptureEntryRow } from './entry-row';
import { CaptureMode } from './types';

export function CaptureScreen() {
  const [mode, setMode] = useState<CaptureMode | undefined>(undefined);

  return (
    <View className="flex-1 justify-center p-inset gap-stack">
      <Text className="font-sans text-title font-bold text-text">
        How do you want to add your work?
      </Text>
      <CaptureEntryRow value={mode} onSelect={setMode} />
    </View>
  );
}
