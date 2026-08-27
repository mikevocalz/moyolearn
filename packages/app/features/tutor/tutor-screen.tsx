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

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { TutorStage, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';
import { buttonSizeForBand, type AgeBand } from '../capture';
import { useTutorStore, API_URL } from './tutor.store';
import { pickNoteImage } from '../schedule/pick-note-image';
import { pickFile } from '../editor/pick-file';
import { useAudioStore } from '../editor/audio.store.ts';
import { evaluateArithmetic } from '@acme/student-model/pure';

export interface TutorScreenProps {
  ageBand?: AgeBand;
}

export function TutorScreen({ ageBand = 'teen' }: TutorScreenProps) {
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const setProblem = useCaptureStore((s) => s.setProblem);
  const { state, start, coach, hintDepth, attachments, addAttachment, removeAttachment } =
    useTutorStore();
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

  /*
    A local URI, staged. Nothing is uploaded until the turn is sent — a child
    who attaches the wrong photo and removes it should never have put it on a
    server in the first place, which is doc 07's data-minimisation rule applied
    to the commonest mistake in the flow.
  */
  const stage = useCallback(
    (picked: { uri: string; name: string } | null, kind: 'image' | 'document', mimeType: string) => {
      if (!picked) return;
      addAttachment({
        id: `${Date.now()}-${picked.name}`,
        kind,
        uri: picked.uri,
        name: picked.name,
        mimeType,
      });
    },
    [addAttachment],
  );

  const handlePickImage = useCallback(() => {
    void pickNoteImage().then((picked) =>
      stage(picked && { uri: picked.uri, name: 'photo.jpg' }, 'image', 'image/jpeg'),
    );
  }, [stage]);

  /*
    Voice, through the recorder the editor already uses.

    Not a second recorder: `AudioRecorderSheet` is mounted at the app root and
    asked for a recording through `audio.store`, exactly as the note editor asks.
    Building a parallel one here would be the "never invent a second way"
    rule broken in the most expensive place — the mic is the affordance a child
    who cannot type quickly depends on.

    The result becomes an attachment like any other, so one send path carries
    words, photos and speech rather than three.
  */
  const requestRecording = useAudioStore((s) => s.request);

  const handleStartRecording = useCallback(() => {
    void requestRecording().then((recording) => {
      if (!recording) return;
      addAttachment({
        id: `${Date.now()}-voice`,
        kind: 'audio',
        uri: recording.uri,
        name: `Voice note (${Math.round(recording.duration)}s)`,
        mimeType: 'audio/m4a',
        durationSec: recording.duration,
      });
    });
  }, [requestRecording, addAttachment]);

  const handlePickDocument = useCallback(() => {
    void pickFile().then((picked) => stage(picked, 'document', 'application/octet-stream'));
  }, [stage]);

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
      attachments={attachments}
      onRemoveAttachment={removeAttachment}
      /*
        Camera stays absent deliberately — the composer hides a control whose
        handler is missing, so an unwired affordance is invisible rather than
        dead. A child who taps something and gets nothing learns the app is
        broken. Photos, files and voice are wired.
      */
      onPickImage={handlePickImage}
      onPickDocument={handlePickDocument}
      onStartRecording={handleStartRecording}
    />
  );
}
