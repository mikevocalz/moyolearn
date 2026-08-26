'use client';
// TutorScreen — the captured problem flows here for the S9 session.
//
// Two things happen when the learner sends a turn, and only one of them is
// visible. `coach` streams what Natalie says; `checkAnswer` updates the student
// model behind it. They are deliberately not chained: the coaching turn must
// not wait on a mastery write, and a mastery write must not be skipped because
// a model call was slow.
// SOT: docs/pack/24-homework-capture-spec.md §5 · docs/pack/23-tutorstage-handoff.md §3 · docs/pack/18-tutor-ai-stack.md §3
// SOT-KEYWORDS: tutor screen capture handoff tutorstage session coach stream age band next problem

import { useEffect, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { TutorStage, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';
import { buttonSizeForBand, type AgeBand } from '../capture';
import { useTutorStore, API_URL } from './tutor.store';
import { evaluateArithmetic } from '@acme/student-model/pure';

export interface TutorScreenProps {
  ageBand?: AgeBand;
}

export function TutorScreen({ ageBand = 'teen' }: TutorScreenProps) {
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const setProblem = useCaptureStore((s) => s.setProblem);
  const { state, start, coach, hintDepth } = useTutorStore();
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

  // The opening turn. Doc 29 §8's demo arc turns on the first thing a child sees
  // being a question rather than a solution, so the coaching starts on arrival
  // rather than waiting for the learner to type something first.
  useEffect(() => {
    if (!problem) return;
    void coach('');
  }, [problem, coach]);

  async function recordAttempt(p: string, answer: string, depth: number): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/api/tutor/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ problem: p, answer, hintDepth: depth }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as { isCorrect: boolean | null };
      if (data.isCorrect !== null) useTutorStore.getState().respond(data.isCorrect);
    } catch {
      // The Safety Plane is the source of truth; the client-side evaluator is
      // the offline fallback for demo and low-connectivity cases.
      const offline = evaluateArithmetic(p, answer);
      if (offline !== null) useTutorStore.getState().respond(offline);
    }
  }

  const handleSend = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    void coach(trimmed);
    void recordAttempt(problem ?? '', trimmed, hintDepth);
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
      onRetry={() => void coach('')}
    />
  );
}
