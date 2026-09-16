'use client';
// Preserve the full source until a measured polygon can be edited and rectified.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: crop preview original page rotate reset source preservation
import { useEffect, useRef, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Image, Text } from '@acme/ui';
import { ScrollView } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface CropPreviewProps {
  ageBand?: AgeBand;
  source: string;
  onCrop: (uri: string) => void;
  onCancel: () => void;
}

export function CropPreview({
  ageBand = 'teen',
  source,
  onCrop,
  onCancel,
}: CropPreviewProps) {
  const [workingUri, setWorkingUri] = useState(source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const revision = useRef(0);
  const rotating = useRef(false);
  const size = buttonSizeForBand(ageBand);
  useEffect(() => {
    revision.current++;
    setWorkingUri(source);
    setError(false);
    return () => {
      revision.current++;
    };
  }, [source]);

  async function rotate() {
    if (rotating.current) return;
    rotating.current = true;
    const request = revision.current;
    setBusy(true);
    setError(false);
    try {
      const result = await ImageManipulator.manipulateAsync(
        workingUri,
        [{ rotate: 90 }],
        {
          format: ImageManipulator.SaveFormat.PNG,
        },
      );
      if (request === revision.current) setWorkingUri(result.uri);
    } catch {
      if (request === revision.current) setError(true);
    } finally {
      rotating.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-stack p-inset"
    >
      <Text className="font-sans text-title font-bold text-text">
        Review your page
      </Text>
      <Image
        alt="Full captured page"
        src={workingUri}
        className="h-64 w-full rounded-card"
      />
      <Text className="font-sans text-body text-text text-center">
        {error
          ? 'Could not rotate the page. Your photo is still here.'
          : 'Check that all of your work is visible.'}
      </Text>
      <Button
        title="Rotate"
        variant="outline"
        size={size}
        onPress={rotate}
        disabled={busy}
      />
      <Button
        title="Reset"
        variant="ghost"
        size={size}
        onPress={() => setWorkingUri(source)}
        disabled={busy}
      />
      <Button
        title="Use this page"
        variant="highlighter"
        size={size}
        fullWidth
        onPress={() => onCrop(workingUri)}
        disabled={busy}
      />
      <Button
        title="Retake"
        variant="outline"
        size={size}
        fullWidth
        onPress={onCancel}
        disabled={busy}
      />
    </ScrollView>
  );
}
