'use client';
// TutorScreen — the captured problem flows here for the S9 session.
// SOT: docs/pack/24-homework-capture-spec.md §5 · docs/pack/23-tutorstage-handoff.md §3
// SOT-KEYWORDS: tutor screen capture handoff tutorstage session pacer zustand

import { useEffect } from 'react';
import { useRouter } from 'solito/router';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { TutorStage, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';
import { useTutorStore } from './tutor.store';

export function TutorScreen() {
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const { state, start, send } = useTutorStore();

  useEffect(() => {
    start(problem);
  }, [problem, start]);

  const respond = useDebouncedCallback(
    (message: string) => useTutorStore.getState().respond(message),
    { wait: 800 },
  );

  const handleSend = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    send(trimmed);
    respond(trimmed);
  };

  if (problem == null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text">No problem selected.</Text>
      </View>
    );
  }

  return (
    <TutorStage
      state={state}
      title="Natalie"
      childName="there"
      captionsEnabled
      onBack={router.back}
      onSend={handleSend}
    />
  );
}
