'use client';
import { create } from 'zustand';
import { streamFetch } from './stream-fetch';
import type { TutorStageState } from '@acme/ui';
import { traceAttempt, DEFAULT_TRACING, inferSkillTitle } from '@acme/student-model/pure';
import { useCaptureStore } from '../capture';
import type { CoachEvent } from './coach.service';

interface TutorState {
  state: TutorStageState;
  problem: string;
  skillTitle: string;
  mastery: number;
  attempts: number;
  hintDepth: number;
  masteryBySkill: Record<string, number>;
  attemptsBySkill: Record<string, number>;
  start: (problem: string | null) => void;
  /** Records the attempt against the student model. Says nothing — `coach` does. */
  respond: (isCorrect: boolean) => void;
  /** Streams a coaching turn. Owns everything the learner sees. */
  coach: (message: string) => Promise<void>;
}

/** One definition, imported by the screen — two would drift in one deploy. */
export const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/**
 * Reads the coach route's SSE frames. Written by hand rather than with
 * `EventSource` because the turn is a POST — `EventSource` is GET-only, and
 * putting a child's problem in a query string puts it in every access log
 * between here and the server.
 */
async function* readCoachEvents(response: Response): AsyncGenerator<CoachEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    // The last element is whatever arrived after the final blank line: either
    // an empty string or a half-received frame. Either way it is not complete.
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      yield JSON.parse(line.slice(5).trim()) as CoachEvent;
    }
  }
}

export const useTutorStore = create<TutorState>((set) => ({
  state: { kind: 'presence' },
  problem: '',
  skillTitle: '',
  mastery: DEFAULT_TRACING.prior,
  attempts: 0,
  hintDepth: 0,
  masteryBySkill: {},
  attemptsBySkill: {},
  start: (problem) => {
    const p = problem ?? '';
    const skillTitle = inferSkillTitle(p);
    set((s) => {
      const mastery = s.masteryBySkill[skillTitle] ?? DEFAULT_TRACING.prior;
      const attempts = s.attemptsBySkill[skillTitle] ?? 0;
      return {
        // `coach` is called the moment a problem lands and owns the surface from
        // there. The canned two-rung hint ladder this used to open with is gone:
        // hinting is the pedagogy contract's job now (doc 18 §3 layer 1), and a
        // fixed ladder underneath a model that scaffolds properly is a second
        // way to do one thing.
        state: { kind: 'thinking' },
        problem: p,
        skillTitle,
        mastery,
        attempts,
        hintDepth: 0,
      };
    });
  },
  coach: async (message) => {
    const { problem } = useTutorStore.getState();
    set({ state: { kind: 'thinking' } });

    let spoken = '';
    try {
      const response = await streamFetch(`${API_URL}/api/tutor/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ problem, message }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      for await (const event of readCoachEvents(response)) {
        if (event.kind === 'chunk') {
          spoken += event.text;
          set({ state: { kind: 'speaking', utterance: { text: spoken } } });
          continue;
        }
        if (event.kind === 'replace') {
          // A retraction, not an append: the plane withdrew what came before it.
          set({ state: { kind: 'speaking', utterance: { text: event.text } } });
          return;
        }
        if (event.kind === 'blocked') {
          set({ state: { kind: 'paused', since: Date.now() } });
          return;
        }
        if (event.kind === 'unavailable') {
          // Retryable, not fail-closed. `paused` is the plane's terminal state
          // and it locks the composer; a missing key or a vendor blip must not
          // put a child in it.
          set({ state: { kind: 'retry' } });
          return;
        }
        return;
      }
    } catch {
      // A transport failure is retryable. Only a Safety Plane decision earns the
      // terminal paused state.
      set({ state: { kind: 'retry' } });
      return;
    }

    // The stream ended without a terminal frame — a dropped connection. The
    // partial turn stays on screen because it already passed the plane, but a
    // turn with nothing in it is the paused state.
    if (!spoken) set({ state: { kind: 'retry' } });
  },
  respond: (isCorrect) => set((s) => {
    const nextAttempts = s.attempts + 1;
    const nextMastery = traceAttempt(s.mastery, isCorrect);
    // No `state` here on purpose. Two writers to one surface race, and the one
    // that wins is whichever network call returned last — so the coaching turn
    // is the only writer and this is bookkeeping ProgressScreen reads.
    return {
      mastery: nextMastery,
      attempts: nextAttempts,
      masteryBySkill: { ...s.masteryBySkill, [s.skillTitle]: nextMastery },
      attemptsBySkill: { ...s.attemptsBySkill, [s.skillTitle]: nextAttempts },
    };
  }),
}));
