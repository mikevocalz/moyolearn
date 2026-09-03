'use client';
import { create } from 'zustand';
import {
  countImages,
  MAX_TUTOR_IMAGES,
  type TutorAttachment,
  type TutorMessage,
  TutorStageState,
  type TutorPresencePreference,
} from '@acme/ui';
import { streamFetch } from './stream-fetch';
import { fetchSession, postMessage } from './session.client.ts';
import { traceAttempt, DEFAULT_TRACING, inferSkillTitle } from '@acme/student-model/pure';
import {
  API_URL,
  COACH_RESPONSE_TIMEOUT_MS,
  COACH_STALL_TIMEOUT_MS,
} from './tutor-constants.ts';
import { audioQueue } from './tutor-audio.ts';
import { isToneKey, type ToneKey } from './tutor-tone';
import type { CoachEvent } from './coach.service';

interface TutorState {
  state: TutorStageState;
  problem: string;
  /**
   * Staged for the next turn, not yet sent.
   *
   * Lives on the store rather than in the composer because a turn is
   * message-plus-attachments: the send path has to read both, and a photo held
   * in component state would be lost the moment the stage re-rendered around a
   * streaming reply.
   */
  /**
   * The conversation so far.
   *
   * Kept because the stage used to render only the CURRENT turn, so a photo a
   * child sent vanished the moment Natalie replied. A tutoring session is a
   * history: re-reading the hint from two turns back is the normal case.
   */
  messages: readonly TutorMessage[];
  /**
   * The server's id for this conversation, once resolved.
   *
   * Null means nothing has been persisted yet, and every write below is a
   * no-op rather than a crash: losing the sync is a smaller failure than
   * refusing to let a child carry on working offline.
   */
  sessionId: string | null;
  /**
   * Resolves the learner's open session and replaces the thread with it.
   *
   * The conversation belongs to the LEARNER, not to the tab, so both devices
   * ask the same question and get the same answer. Identity never travels —
   * the server reads it from `ctx`.
   */
  hydrate: (problem: string) => Promise<void>;
  /**
   * Appends a learner turn. Pass `id` to adopt the server's, which is what
   * lets a queued upload address its attachment later.
   */
  say: (message: Omit<TutorMessage, 'id'> & { id?: string }) => void;
  attachments: readonly TutorAttachment[];
  addAttachment: (attachment: TutorAttachment) => void;
  removeAttachment: (id: string) => void;
  /**
   * Fills in a voice note's transcript once it has been written out.
   *
   * Updates the STAGED attachment and any already sent, because a note is
   * commonly transcribed after its turn has gone — the thread should catch up
   * rather than keep saying "Writing this out…" forever.
   */
  setAttachmentTranscript: (id: string, transcript: string) => void;
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
  /** Natalie's display presentation. Does not affect the model, voice, or captions. */
  tutorPresence: TutorPresencePreference;
  /** Override the recommended default (e.g. the learner chose Voice only). */
  setTutorPresence: (presence: TutorPresencePreference) => void;
  /** The current tone from the coaching turn; drives voice and face. */
  currentTone: ToneKey | null;
}

/**
 * The end of a day's work, in the stage's own vocabulary.
 *
 * Effort and what she did, never a streak and never a limit (doc 07's
 * break-nudge). `masteryDelta: 0` because the summary is about the session
 * ending, not about a measurement — the progress surfaces own that number and
 * inventing one here would put a score on a screen whose message is "you're
 * done for today".
 */
const DONE_FOR_TODAY: TutorStageState = {
  kind: 'ended',
  summary: { title: 'Great work today', masteryDelta: 0 },
};

/**
 * Module-level audio queue for the live tutor voice. It is not React state so
 * it survives re-renders and is owned by the store, not a component.
 * Imported from `tutor-audio` so the avatar can share the same instance.
 */

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
  attachments: [],
  messages: [],
  /*
    `auto`, NOT `compact`, and the difference is everything downstream.

    `tutor-screen` resolves presence from the grade band, the size class and the
    reduced-motion setting — but only when the stored value is `auto`. Seeding
    a concrete `compact` here meant that resolution never ran once: a K–2
    learner, whose band the responsive spec puts at `visible` precisely because
    voice-first children need a face, silently got the 6–12 register, and a
    learner with Reduce Motion on was never demoted to `audio-only`. The whole
    of `recommendedTutorPresenceFor` was unreachable code.

    `auto` means "nobody has chosen yet". The first time the learner presses the
    reveal rail this becomes a concrete value and stays one — an explicit
    preference outranks auto (spec §1, resolution order 1).
  */
  tutorPresence: 'auto' as TutorPresencePreference,
  currentTone: null,
  sessionId: null,
  skillTitle: '',
  mastery: DEFAULT_TRACING.prior,
  attempts: 0,
  hintDepth: 0,
  masteryBySkill: {},
  attemptsBySkill: {},
  hydrate: async (problem) => {
    const snapshot = await fetchSession(problem);
    if (snapshot === null) return;

    const problemText = snapshot.problem.length > 0 ? snapshot.problem : problem;
    const sessionComplete = snapshot.budget.kind === 'session-complete';

    /*
      Only a TRAILING tutor turn. One with the child's reply after it is finished
      business and belongs in the thread; only the last one is still awaiting an
      answer.
    */
    const last = snapshot.messages[snapshot.messages.length - 1];
    const lastTutorTurn = last?.role === 'tutor' ? last : undefined;
    const history = lastTutorTurn ? snapshot.messages.slice(0, -1) : snapshot.messages;

    set((s) => ({
      sessionId: snapshot.sessionId,
      problem: problemText.length > 0 ? problemText : s.problem,
      /*
        A RESUMED session is not a thinking one.

        `start` sets `thinking` because a problem landing is immediately
        followed by a coaching turn — true on a fresh session, false on a
        resumed one, where the opening turn is deliberately suppressed. Nothing
        was coming, so the badge sat on "Thinking" forever and the child was
        told the tutor was working on something she had already answered.

        THE LAST TUTOR TURN COMES BACK LIVE, not as history.

        `presence` was wrong here twice over. It draws "we were on question N —
        want to pick up there?", and nothing has ever passed a question number,
        so a returning child read "we were on question ..." — a placeholder
        standing exactly where the question should be. Worse, it answered a
        question nobody asked while withholding the one that matters: WHERE THEY
        LEFT OFF.

        Natalie's last turn is what the child was in the middle of answering, so
        it is restored where it was when they closed the laptop — the live turn,
        above the composer, thread behind it. The screen looks like they never
        left, which is the only version of "pick up where you left off" that does
        not make the child reconstruct it.

        Held out of `messages` for the same reason a reply is held out while it
        is still being spoken: live or historical, never both, or it draws twice.
      */
      /*
        The end-of-session state OUTRANKS both, because it is the only one of
        the three that closes the composer. Doc 12 §7's exhausted budget is not
        a failure and gets no error surface: the stage draws the "great work
        today" summary, which is doc 07's break-nudge and the cost ceiling being
        the same control. A child is never shown a limit, a count, or a price.
      */
      state: sessionComplete
        ? DONE_FOR_TODAY
        : lastTutorTurn !== undefined
          ? { kind: 'speaking' as const, utterance: { text: lastTutorTurn.text, restored: true } }
          : s.state,
      /*
        REPLACED, not merged.

        The server is the conversation; this store is a view of it. Merging
        would mean inventing a reconciliation rule for two devices that appended
        while offline, and the honest version of that rule is "ask the server",
        which is what this does. A turn typed here and not yet persisted is the
        only thing at risk, and it is at risk for one round trip.
      */
      messages: [
        /*
          The problem leads, on every device.

          `start` seeds it locally when the thread is empty, and this replaces
          the thread wholesale — so without re-seeding here, a hydrate would
          delete the question on a fresh session and never show it on a resumed
          one. Keyed on the session rather than the clock so it is the same
          bubble on both devices instead of two different ids for one question.
        */
        ...(problemText.length > 0
          ? [{ id: `problem-${snapshot.sessionId}`, role: 'tutor' as const, text: problemText }]
          : []),
        ...history.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachments: m.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          /*
            The REMOTE url when the bytes have landed, and the attachment's own
            id when they have not. A second device has no access to the first
            one's `blob:`/`file:` uri, so a turn whose upload is still draining
            renders as pending rather than as a broken picture.
          */
          uri: a.url ?? '',
          name: a.name,
          mimeType: a.mimeType,
          durationSec: a.durationSec,
          transcript: a.transcript,
          expiresAt: a.expiresAt,
          storageKey: a.storageKey,
        })),
        })),
      ],
    }));
  },

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
        /*
          The problem is the FIRST message, not just live state.

          It used to live only in the state block, so the moment a child
          answered, the thing they were answering scrolled out of existence.
          A child re-reading the question halfway through working it out is not
          an edge case — it is what working something out looks like.

          Seeded only when the session has a problem and the thread is empty, so
          resuming a conversation does not staple a duplicate to the top.
        */
        messages:
          p && s.messages.length === 0
            ? [{ id: `problem-${Date.now()}`, role: 'tutor' as const, text: p }]
            : s.messages,
        skillTitle,
        mastery,
        attempts,
        hintDepth: 0,
      };
    });
  },
  /*
    The cap is enforced HERE, not in the composer.

    The picker can hand back several images at once and a screen could call this
    directly, so a check that lives in the button is a check with a way around
    it. The composer separately hides the attach control at the cap — that is
    the courtesy; this is the rule.
  */
  say: (message) => {
    // A new learner turn is the barge-in signal: stop whatever Natalie is saying
    // so the child is not competing with the previous reply.
    audioQueue.stop();

    set((s) => ({
      ...s,
      /*
        THE STANDING REPLY BECOMES HISTORY HERE, ahead of the turn that
        supersedes it.

        Natalie's turns were never in `messages` at all — `coach` only set
        `state.utterance`, which the stage draws as the live bubble, so each
        reply was overwritten by the next and a child could scroll back through
        only their own half of the conversation. The comment on `messages` said
        tutor turns "are appended by the stream itself"; nothing ever did.

        It has to happen on the CHILD's turn rather than at the start of the
        next coaching call, and that ordering is the whole subtlety: `handleSend`
        says the learner message first and asks for coaching second, so flushing
        inside `coach` filed each reply AFTER the question that followed it. The
        thread read answer-then-question. Verified on screen, which is the only
        way that class of mistake shows up.

        A tutor turn is live or historical and never both — appending while the
        utterance still stands would draw it twice, once from `messages` and
        once from the stage.
      */
      messages: [
        ...s.messages,
        ...(s.state.kind === 'speaking' && s.state.utterance.text.length > 0
          ? [
              {
                id: `tutor-${Date.now()}`,
                role: 'tutor' as const,
                text: s.state.utterance.text,
              },
            ]
          : []),
        { ...message, id: message.id ?? `${Date.now()}-${s.messages.length}` },
      ],
    }));
  },

  addAttachment: (attachment) =>
    set((s) => {
      if (attachment.kind === 'image' && countImages(s.attachments) >= MAX_TUTOR_IMAGES) return s;
      return { ...s, attachments: [...s.attachments, attachment] };
    }),

  removeAttachment: (id) =>
    set((s) => ({ ...s, attachments: s.attachments.filter((a) => a.id !== id) })),

  setAttachmentTranscript: (id, transcript) =>
    set((s) => ({
      ...s,
      attachments: s.attachments.map((a) => (a.id === id ? { ...a, transcript } : a)),
      messages: s.messages.map((m) =>
        m.attachments?.some((a) => a.id === id)
          ? { ...m, attachments: m.attachments.map((a) => (a.id === id ? { ...a, transcript } : a)) }
          : m,
      ),
    })),

  coach: async (message) => {
    const { problem, state, sessionId } = useTutorStore.getState();

    /*
      The floor under the closed composer.

      `hydrate` already put the stage in `ended` when the gateway said the day
      was done, and the stage draws no composer in that state — so this branch
      should be unreachable. It is here because "should be unreachable" is what
      the screen believes and this store is what a second entry point would call:
      the ONE thing that must never happen is a spent day producing an error
      surface, and the cheapest way to guarantee it is to never make the call.
      The gateway refuses it too, silently; this is what keeps the badge from
      sitting on "Thinking" while it does.
    */
    if (state.kind === 'ended') return;

    set({ state: { kind: 'thinking' } });

    /*
      Called from every exit that ends with a reply the child can read, which is
      not the same set as "the loop finished".

      I first put this after the loop and it never ran once: the terminal frame
      hits the bare `return` below, so a normal, successful turn leaves through
      the middle of the loop and skips everything after it. The learner's half
      of the conversation persisted and Natalie's silently did not — visible
      only by reading the session back off the server, because on screen the
      reply was right there.

      `blocked` and `unavailable` are deliberately NOT here. A withheld turn is
      not a turn, and storing it would resume a child into a conversation that
      contains the moment the plane stopped it.
    */
    const remember = (text: string) => {
      if (text.length === 0) return;
      const { sessionId } = useTutorStore.getState();
      if (sessionId === null) return;
      // Fire-and-forget: the reply is already on screen and already through the
      // plane, so a slow write must not hold the child up and a failed one
      // costs a resume, not a turn.
      void postMessage({ sessionId, role: 'tutor', text });
    };

    // A new coaching turn starts; anything still queued for the previous turn
    // is now stale and should be stopped as soon as the queue tracks the active
    // source for barge-in.
    audioQueue.stop();

    let spoken = '';
    /*
      The stall budget (doc 29 §8: "short client timeout with a graceful line,
      not an infinite spinner").

      `fetch` never times out on its own, so a connection that opens and dies —
      the ordinary failure on a room's congested network — used to leave this
      promise pending forever with the stage on "Thinking" and no exit but
      killing the app. Aborting is what turns that into the `retry` branch
      below, which is a sentence and a button.

      Re-armed rather than a single deadline: the first window covers the wait
      for headers, and every frame that arrives buys another window, so a long
      healthy turn is never cut off and a silent socket never hangs.
    */
    const controller = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const armStall = (ms: number): void => {
      if (stallTimer !== undefined) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), ms);
    };
    armStall(COACH_RESPONSE_TIMEOUT_MS);

    try {
      const response = await streamFetch(`${API_URL}/api/tutor/coach`, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        /*
          The session travels so a safety event can point at the conversation it
          came from — doc 07 §S26 offers a guardian an excerpt, and an alert with
          nothing to open is an alert a parent cannot act on. It is a handle and
          not an identity: the server files the event against whoever the cookie
          says this is, so naming someone else's session mislabels only your own
          row. `null` before the session resolves, which is a real case on the
          opening turn.
        */
        body: JSON.stringify({ problem, message, sessionId: sessionId ?? undefined }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      armStall(COACH_STALL_TIMEOUT_MS);

      for await (const event of readCoachEvents(response)) {
        armStall(COACH_STALL_TIMEOUT_MS);
        if (event.kind === 'chunk') {
          spoken += event.text;
          const tone = event.voice?.tone;
          set({
            state: { kind: 'speaking', utterance: { text: spoken } },
            currentTone: tone && isToneKey(tone) ? tone : null,
          });
          if (event.voice) {
            audioQueue.enqueue(event.text, event.voice);
          }
          continue;
        }
        if (event.kind === 'replace') {
          audioQueue.stop();
          // A retraction, not an append: the plane withdrew what came before it.
          set({ state: { kind: 'speaking', utterance: { text: event.text } } });
          remember(event.text);
          return;
        }
        if (event.kind === 'blocked') {
          audioQueue.stop();
          set({ state: { kind: 'paused', since: Date.now() } });
          return;
        }
        if (event.kind === 'unavailable') {
          audioQueue.stop();
          // Retryable, not fail-closed. `paused` is the plane's terminal state
          // and it locks the composer; a missing key or a vendor blip must not
          // put a child in it.
          set({ state: { kind: 'retry' } });
          return;
        }
        // The terminal frame. This is how a NORMAL turn leaves the loop.
        remember(spoken);
        return;
      }
    } catch {
      audioQueue.stop();
      // A transport failure is retryable, and an aborted stall arrives here as
      // one. Only a Safety Plane decision earns the terminal paused state.
      set({ state: { kind: 'retry' } });
      return;
    } finally {
      // Every exit above returns from inside the try, including the normal one,
      // so the timer is cleared here or not at all — a live timer would abort
      // the NEXT turn's controller-free work and, on native, hold a task alive.
      if (stallTimer !== undefined) clearTimeout(stallTimer);
    }

    // The stream ended without a terminal frame — a dropped connection. The
    // partial turn stays on screen because it already passed the plane, but a
    // turn with nothing in it is the paused state.
    if (!spoken) {
      set({ state: { kind: 'retry' } });
      return;
    }
    remember(spoken);
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
  setTutorPresence: (presence) => set({ tutorPresence: presence }),
}));
