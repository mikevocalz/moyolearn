'use client';
// Web cannot record here — VisionCamera is native only, and browser recording is
// MediaRecorder, a different component. Saying so is better than rendering a
// viewfinder that never lights up.
// SOT-KEYWORDS: video note sheet web unavailable
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import type { VideoNoteSheetProps } from './VideoNoteSheet.native.tsx';

export type { VideoNoteSheetProps };

export function VideoNoteSheet({ onCancel }: VideoNoteSheetProps) {
  return (
    <View className="gap-stack p-inset">
      <Text className="text-body text-text">Recording a video needs the app.</Text>
      <Text className="text-caption text-text-muted">
        You can still attach a video you have already recorded.
      </Text>
      <Button title="Close" variant="outline" onPress={onCancel} />
    </View>
  );
}
