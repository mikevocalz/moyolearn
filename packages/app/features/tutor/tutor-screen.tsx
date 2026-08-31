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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { TutorStage, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useCaptureStore } from '../capture';
import { buttonSizeForBand, type AgeBand } from '../capture';
import { useAppSession } from '../../providers/session';
import { useTutorStore } from './tutor.store';
import { API_URL } from './tutor-constants.ts';
import { pickNoteImage } from '../schedule/pick-note-image';
import { pickFile } from '../editor/pick-file';
import { useAudioStore } from '../editor/audio.store.ts';
import { readAttachment } from '../capture/read-attachment';
import { transcribe } from '../capture/transcribe';
import { useUploadQueue, setUploadReporter } from '../media';
import { patchAttachment, postMessage } from './session.client.ts';
import { evaluateArithmetic } from '@acme/student-model/pure';

export interface TutorScreenProps {
  ageBand?: AgeBand;
}

export function TutorScreen({ ageBand: ageBandProp }: TutorScreenProps) {
  const { activeContext } = useAppSession();
  // Resolve the learner's presentation band from the session before rendering.
  // No implicit `teen` fallback: an unknown band is treated as the adult (9-12)
  // register so a missed context does not hand a high-schooler a childish shell.
  const ageBand = ageBandProp ?? activeContext?.gradeBand ?? 'adult';
  const router = useRouter();
  const problem = useCaptureStore((s) => s.problem);
  const setProblem = useCaptureStore((s) => s.setProblem);
  const { state, start, coach, hintDepth, attachments, addAttachment, removeAttachment, setAttachmentTranscript, messages, say, hydrate, sessionId } =
    useTutorStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    start(problem);
  }, [problem, start]);

  /*
    RESUME BEFORE ANYTHING ELSE.

    A child does homework on the family laptop and finishes it on a phone in the
    car, and until this ran the conversation did not survive a page RELOAD, let
    alone a change of device: the store was a bare `create` with no persistence
    and Natalie's half was never recorded at all.

    The conversation belongs to the learner rather than to the tab, so both
    devices ask the same question — "what is my open session" — and the server
    answers it from `ctx`. Nothing about identity travels.
  */
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    void hydrate(problem ?? '').finally(() => setResumed(true));
  }, [problem, hydrate]);

  /*
    Points a stored attachment at its bytes the moment the queue lands them.

    The upload drains AFTER the turn is written — deliberately, so the tutor
    answers while the transfer is still going — which means the message exists
    for a while with no url on it. The other device shows that turn as pending
    and picks the picture up on its next read. Registered once, at the surface
    that owns the session, because the reporter is process-wide.
  */
  useEffect(() => {
    setUploadReporter((completed) => {
      if (completed.messageId === undefined || completed.attachmentId === undefined) return;
      void patchAttachment({
        sessionId: completed.sessionId,
        messageId: completed.messageId,
        attachmentId: completed.attachmentId,
        url: completed.url,
        storageKey: completed.storageKey,
      });
    });
  }, []);

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
  const opened = useRef(false);
  useEffect(() => {
    if (!problem || !resumed || opened.current) return;
    /*
      ONLY WHEN THERE IS NOTHING TO RESUME.

      This fired on every mount, which was harmless while the conversation died
      with the tab and is not now: a resumed session would get a fresh opening
      turn appended on every reload, so a child returning to their homework
      three times would find Natalie had introduced the problem three times.

      Gated on hydration having finished rather than on `messages` being empty
      at first paint — the thread is empty for the round trip either way, and
      opening on that would race the resume and duplicate exactly what it is
      meant to prevent.
    */
    opened.current = true;
    if (useTutorStore.getState().messages.length > 0) return;
    void coach('');
  }, [problem, resumed, coach]);

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
    const staged = attachments;
    if (!trimmed && staged.length === 0) return;

    /*
      Photos are READ before the turn goes out, and their text becomes part of
      it. This is what closes the loop the whole feature exists for: a child
      photographs a problem, and the tutor coaches THAT problem rather than
      generating one of its own.

      The read happens on-device — ExecuTorch on native, Tesseract with a
      TrOCR escalation for handwriting on web — so a photograph costs nothing
      per image and never leaves the device to be understood.
    */
    void (async () => {
      const images = staged.filter((a) => a.kind === 'image');
      const readings = await Promise.all(images.map((image) => readAttachment(image.uri)));
      const fromImages = readings.filter((r) => r.length > 0);

      // The first legible photo becomes the session's problem when there isn't
      // one — the child's own work outranks anything the app would have picked.
      if (fromImages[0] !== undefined && !problem) setProblem(fromImages[0]);

      /*
        SPEECH IS A TURN, and this is where it stopped being one.

        The turn was built from the photos' OCR and the typed text, and nothing
        else. A voice note carried a transcript — `transcribe()` produced one and
        `setAttachmentTranscript` stored it — and then the send path did not read
        it. So a child who answered out loud sent an EMPTY turn, and the tutor,
        handed nothing, asked its question again. Every part of the voice feature
        worked except the one line that puts it in front of the model.

        Awaited, not read optimistically. Transcription is deliberately deferred
        so the note appears in the tray the instant the child stops speaking, and
        the first Whisper run downloads a model — so on a fast send the field is
        still empty. Awaiting here is the same shape the photos already use, and
        it removes the race rather than narrowing it.
      */
      const spoken = await Promise.all(
        staged
          .filter((a) => a.kind === 'audio')
          .map(async (a) => a.transcript ?? (await transcribe(a.uri))),
      );
      const fromAudio = spoken.filter((t) => t.trim().length > 0);

      const parts = [
        ...fromImages.map((text, i) =>
          fromImages.length > 1 ? `Problem ${i + 1}:\n${text}` : text,
        ),
        ...fromAudio,
        ...(trimmed ? [trimmed] : []),
      ];

      /*
        Into the transcript BEFORE clearing the tray, and carrying the
        attachments themselves — the bubble renders the photo the child sent,
        not the text that was read out of it. A thread that showed only the OCR
        result would be showing the app's reading of their homework rather than
        their homework.
      */
      /*
        Carrying the transcript we just awaited, not the copy captured before it
        existed. `staged` was read at the top of this function — for a voice note
        sent quickly that snapshot predates transcription, so the bubble would
        render a player with no words under it and a guardian reviewing the
        session would find a turn they cannot read. Doc 07's premise is that an
        adult can see what a child said to the model.
      */
      const spokenById = new Map(
        staged
          .filter((a) => a.kind === 'audio')
          .map((a, i) => [a.id, spoken[i] ?? ''] as const),
      );
      const said = staged.map((a) => {
        const text = spokenById.get(a.id);
        return text !== undefined && text.length > 0 && a.transcript === undefined
          ? { ...a, transcript: text }
          : a;
      });

      /*
        PERSISTED FIRST, so the local turn can adopt the SERVER's id.

        The id is not cosmetic: a queued upload finishes minutes later and has
        to say which attachment of which message it just filled in. A local
        `Date.now()` id means nothing to the other device, so the completion
        would have nowhere to land and the picture would stay pending forever.

        A failed write is not a blocked turn. `postMessage` returns null and the
        turn proceeds unsynced — a child on a dropped connection keeps working,
        and the next `hydrate` reconciles. Losing the sync is a smaller failure
        than refusing to let them answer.
      */
      const persisted =
        sessionId === null
          ? null
          : await postMessage({
              sessionId,
              role: 'learner',
              text: trimmed,
              attachments: said.map((a) => ({
                id: a.id,
                kind: a.kind,
                name: a.name,
                mimeType: a.mimeType,
                durationSec: a.durationSec,
                transcript: a.transcript,
              })),
            });

      say({ role: 'learner', text: trimmed, attachments: said, id: persisted?.id });

      /*
        Queued, not uploaded inline.

        The turn has already gone — the tutor is coaching from the OCR text, and
        the child is waiting on a reply, not on a file transfer. Uploading here
        would make a slow network delay the answer, and a dropped one lose the
        photo entirely. The queue outlives both the request and the process, so
        a failed transfer is retried later instead of costing the child their
        homework.
      */
      staged.forEach((item) =>
        enqueue({
          id: item.id,
          uri: item.uri,
          name: item.name,
          mimeType: item.mimeType,
          /*
            The real session, not the problem text. This passed
            `problem ?? 'session'` — the problem STRING used as a grouping key —
            while the field's own comment said it existed "so a drained upload
            can be attached to its turn". It never was, because nothing
            downstream could turn a maths question into a conversation.
          */
          sessionId: sessionId ?? '',
          messageId: persisted?.id,
          attachmentId: item.id,
        }),
      );

      // Cleared only after the turn is in the transcript, so a failed read
      // still leaves the photos somewhere rather than dropping them silently.
      staged.forEach((a) => removeAttachment(a.id));

      const turn = parts.join('\n\n');
      void coach(turn);
      void recordAttempt(problem ?? fromImages[0] ?? '', trimmed || fromAudio.join(' '), hintDepth);
    })();
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
  // Live state so the composer can draw the take as it happens.
  const live = useAudioStore((s) => s.live);
  const stopRecording = useAudioStore((s) => s.stop);
  const resolveRecording = useAudioStore((s) => s.resolve);
  const enqueue = useUploadQueue((s) => s.enqueue);

  /*
    Set when the child ends a take with SEND rather than STOP, and cleared by
    the effect below once the note is actually in the tray.

    The send cannot fire where it is pressed. `stop()` resolves the recorder
    asynchronously and the attachment only exists after that resolution, so
    calling the send path immediately would read a tray that does not yet hold
    the note — and send an empty turn.
  */
  const sendOnStop = useRef(false);
  const sendWhenStaged = useRef<string | null>(null);

  const handleStartRecording = useCallback(() => {
    void requestRecording().then((recording) => {
      if (!recording) return;
      const id = `${Date.now()}-voice`;
      if (sendOnStop.current) {
        sendOnStop.current = false;
        sendWhenStaged.current = id;
      }
      addAttachment({
        id,
        kind: 'audio',
        uri: recording.uri,
        name: `Voice note (${Math.round(recording.duration)}s)`,
        mimeType: 'audio/m4a',
        durationSec: recording.duration,
      });

      /*
        Transcribed AFTER staging, not before.

        A child should see their note appear the instant they stop speaking;
        Whisper's first run downloads a model and takes seconds. Blocking the
        tray on it would make the app feel broken at the one moment the child is
        least sure it heard them. The bubble says "Writing this out…" until this
        lands.
      */
      void transcribe(recording.uri).then((text) => {
        if (text.length > 0) setAttachmentTranscript(id, text);
      });
    });
  }, [requestRecording, addAttachment]);

  /*
    Fires the deferred send once the staged note is visible in `attachments`.
    Keyed on the tray rather than a timer: the only thing that makes the turn
    sendable is the note being IN it, so that is what this waits for.
  */
  useEffect(() => {
    const id = sendWhenStaged.current;
    if (id === null) return;
    if (!attachments.some((a) => a.id === id)) return;
    sendWhenStaged.current = null;
    handleSend('');
  });

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
      messages={messages}
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
      recording={live ?? undefined}
      /* Discard settles the promise as cancelled, so the take is dropped and
         the composer returns to its normal row. */
      onCancelRecording={() => resolveRecording(null)}
      /* Stop: end the take and let the recorder's own `onstop` resolve with the
         file, rather than racing it here. The note lands in the tray with a
         player, so the child hears it before deciding. */
      onStopRecording={() => stopRecording?.()}
      /* Send: the same stop, plus a flag the effect above acts on once the note
         is staged. One press for a child who does not want to check. */
      onSendRecording={() => {
        sendOnStop.current = true;
        stopRecording?.();
      }}
    />
  );
}
