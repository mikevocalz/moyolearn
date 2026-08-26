'use client';
// TutorScreen — the captured problem flows here for the S9 session.
// SOT: docs/pack/24-homework-capture-spec.md §5 · docs/pack/23-tutorstage-handoff.md §3
// SOT-KEYWORDS: tutor screen capture handoff tutorstage session pacer zustand age band next problem

import { useEffect, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { TutorStage, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';
import { buttonSizeForBand, type AgeBand } from '../capture';
import { useTutorStore } from './tutor.store';
import { evaluateArithmetic } from '@acme/student-model/pure';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

export interface TutorScreenProps {
  ageBand?: AgeBand;
}

export function TutorScreen({ ageBand = 'teen' }: TutorScreenProps) {
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const setProblem = useCaptureStore((s) => s.setProblem);
  const { state, start, send, tryIt, nextHint, unanswerable, hintDepth } = useTutorStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    start(problem);
  }, [problem, start]);

  useEffect(() => {
    if (problem) return;
    setLoading(true);
    fetch(`${API_URL}/api/tutor/next`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = (await res.json()) as { problem: string; skillTitle: string };
        setProblem(data.problem);
      })
      .catch(() => {
        // Leave the empty state if the server is unreachable.
      })
      .finally(() => {
        setLoading(false);
      });
  }, [problem, setProblem]);

  const respond = useDebouncedCallback(
    (isCorrect: boolean) => useTutorStore.getState().respond(isCorrect),
    { wait: 800 },
  );

  async function checkAnswer(p: string, answer: string, depth: number): Promise<boolean | null> {
    try {
      const res = await fetch(`${API_URL}/api/tutor/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ problem: p, answer, hintDepth: depth }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json() as { isCorrect: boolean | null };
      return data.isCorrect;
    } catch {
      // The Safety Plane is the source of truth; the client-side evaluator is
      // the offline fallback for demo and low-connectivity cases.
      return evaluateArithmetic(p, answer);
    }
  }

  const handleSend = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    send(trimmed);
    const isCorrect = await checkAnswer(problem ?? '', trimmed, hintDepth);
    if (isCorrect === null) {
      unanswerable();
      return;
    }
    respond(isCorrect);
  };

  if (problem == null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text">
          {loading ? 'Finding your next problem...' : 'No problem selected.'}
        </Text>
      </View>
    );
  }

  return (
    <TutorStage
      state={state}
      title="Natalie"
      childName="there"
      captionsEnabled
      buttonSize={buttonSizeForBand(ageBand)}
      onBack={router.back}
      onSend={handleSend}
      onTryIt={tryIt}
      onNextHint={nextHint}
    />
  );
}
