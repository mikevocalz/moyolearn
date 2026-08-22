'use client';
// TutorScreen — the captured problem flows here for the S9 session.
// SOT: docs/pack/24-homework-capture-spec.md §5 · docs/pack/23-tutorstage-handoff.md §3
// SOT-KEYWORDS: tutor screen capture handoff tutorstage session

import { useState } from 'react';
import { useRouter } from 'solito/router';
import { TutorStage, type TutorStageState } from '@acme/ui';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';

export function TutorScreen() {
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const [state, setState] = useState<TutorStageState>({
    kind: 'speaking',
    utterance: { text: problem ? `Let's work on: ${problem}` : "What would you like to work on?" },
  });

  const handleSend = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setState({ kind: 'thinking' });
    setTimeout(() => {
      setState({
        kind: 'speaking',
        utterance: { text: `You said: ${trimmed}. What do you think the next step is?` },
      });
    }, 800);
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
