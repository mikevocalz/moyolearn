'use client';
// CaptureScreen — the six-stage homework-capture journey plus its terminal
// success surface.
//
// The media layer underneath (queue, TUS, presign, retry, EXIF stripping)
// is unchanged. Only the learner-facing surface and the step vocabulary
// move to the "one confident journey" build prompt.
//
// Stages (1–6) and the terminal surface (7):
//   1. Choose how to share work
//   2. Capture (camera, photo library, file, type, voice)
//   3. Review pages (reorder, remove, crop, add another, confirm count)
//   4. Read and verify (OCR or transcript review, never low-confidence success)
//   5. Add context (subject, assignment, due date, stuck — all skippable)
//   6. Upload / process (Preparing, Uploading, Processing, Ready)
//   7. Success (thumbnails, title, privacy summary, one clear action)
// Mobbin: mobbin.com/screens/f64fa10a-926f-49d0-a36d-d3a300b9daf6 (Binance — heading + one-line prompt copy above the capture-source options, camera path first) ·
// mobbin.com/screens/79bc88c8-16d5-4d07-b2ff-3df2811fb272 (Cleo AI — "how would you like to upload?" step: title block, support sentence, then the source chooser as the whole body) ·
// mobbin.com/screens/9c8e39a1-23fe-4f31-8d45-cda3c44e3ccc (Google Lens homework mode — one instruction line pointing at the photo action as the way in). Structure only.
// SOT: docs/pack/24-homework-capture-spec.md §1
// SOT-KEYWORDS: capture screen choose capture review verify context upload success age band

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { pickFile } from '../editor/pick-file';
import { pickNoteImage } from '../schedule/pick-note-image';
import {
  Button,
  Container,
  Heading,
  IconButton,
  Image,
  SafeArea,
  Text,
  Textarea,
  TextField,
  VoiceRecorder,
  type VoiceRecording,
} from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { ChevronDown, ChevronUp, X } from '@acme/ui/icons';
import { useTransferTray } from '../media/transfer-tray.store';
import { useUploadQueue } from '../media/upload-queue.store';
import { drainNow } from '../media/upload-queue';
import { useOnline } from '../media/use-online';
import { MEDIA_TTL_DAYS } from '../media/retention';
import { CaptureEntryRow } from './entry-row';
import { GuidedFrame } from './guided-frame';
import { CaptureTip } from './capture-tip';
import { DigitizedTextReview } from './digitized-text-review';
import { OcrReview } from './ocr-review';
import { CropPreview } from './crop-preview';
import { useCaptureStore } from './capture.store';
import { buttonSizeForBand, captureLabelsForBand, type AgeBand } from './age-band';
import { stripExif } from './privacy-process';
import { transcribe } from './transcribe';
import { uploadPhaseKey, type UploadPhaseKey } from './upload-phase';
import { CaptureContext, CaptureMode, CapturePage, CaptureStep } from './types';

function newId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function imagePage(uri: string): CapturePage {
  return { id: newId(), uri, kind: 'image' };
}

function photoPage(uri: string): CapturePage {
  return { id: newId(), uri, kind: 'photo' };
}

function filePage(uri: string): CapturePage {
  return { id: newId(), uri, kind: 'file' };
}

function mimeForFile(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

function looksLikeImage(name: string): boolean {
  const mt = mimeForFile(name);
  return mt.startsWith('image/');
}

export interface CaptureScreenProps {
  ageBand?: AgeBand;
  /** Show an "Example" disclosure for demo/seeded worksheets. */
  isExample?: boolean;
}

function TypeCapture({ ageBand, onDone }: { ageBand: AgeBand; onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  const size = buttonSizeForBand(ageBand);
  const label = ageBand === 'young' ? 'Type the problem' : 'Type or paste your work';
  return (
    <View className="flex-1 gap-stack p-inset">
      <Textarea
        label={label}
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button
        title="Done"
        variant="highlighter"
        size={size}
        fullWidth
        onPress={() => onDone(text)}
        disabled={text.trim().length === 0}
      />
    </View>
  );
}

function VoiceCapture({ ageBand, onDone, onCancel }: { ageBand: AgeBand; onDone: (r: VoiceRecording) => void; onCancel: () => void }) {
  return (
    <View className="flex-1 p-inset gap-stack">
      <Text className="font-sans text-body text-text text-center">
        {ageBand === 'young' ? 'Tell me about your work' : 'Describe the problem by voice'}
      </Text>
      <VoiceRecorder
        onComplete={onDone}
        onCancel={onCancel}
        className="flex-1"
      />
    </View>
  );
}

function VoiceReadVerify({
  ageBand,
  recording,
  onConfirm,
  onCancel,
}: {
  ageBand: AgeBand;
  recording: VoiceRecording;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    void transcribe(recording.uri)
      .then((t) => {
        if (!cancelled) {
          setText(t);
          setPhase('ready');
        }
      })
      .catch(() => {
        /*
          A rejected transcription lands in the editable review, never a
          spinner that never ends. The child said the words; an empty box they
          can type into beats "Getting your words ready..." forever.
        */
        if (!cancelled) setPhase('ready');
      });
    return () => { cancelled = true; };
  }, [recording.uri]);

  if (phase === 'loading') {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">
          Getting your words ready...
        </Text>
      </View>
    );
  }

  return <DigitizedTextReview ageBand={ageBand} initialText={text} onConfirm={onConfirm} onCancel={onCancel} />;
}

function AddContext({
  ageBand,
  context,
  onChange,
  onContinue,
  onSkip,
}: {
  ageBand: AgeBand;
  context: CaptureContext;
  onChange: (next: CaptureContext) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const size = buttonSizeForBand(ageBand);
  /*
    Doc 31 band law: no due-work pressure on the young bands. A free-text
    "Due date" in front of a K-2/3-5 learner is schedule anxiety they can
    neither read nor own, so young/child get a single subject field and
    nothing else. Skip stays on every band — context is always optional.
  */
  const youngBand = ageBand === 'young' || ageBand === 'child';
  return (
    <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
      <Text className="font-sans text-title font-bold text-text">
        {youngBand ? 'Add a little info' : 'Add context (optional)'}
      </Text>
      <TextField
        label={youngBand ? 'What subject?' : 'Subject / class'}
        value={context.subject}
        onChangeText={(subject) => onChange({ ...context, subject })}
      />
      {youngBand ? null : (
        <>
          <TextField
            label="Assignment"
            value={context.assignment}
            onChangeText={(assignment) => onChange({ ...context, assignment })}
          />
          <TextField
            label="Due date"
            value={context.dueDate}
            onChangeText={(dueDate) => onChange({ ...context, dueDate })}
          />
          <Textarea
            label="Where are you stuck?"
            value={context.stuck}
            onChangeText={(stuck) => onChange({ ...context, stuck })}
            containerClassName="min-h-32"
          />
        </>
      )}
      <Button title="Continue" variant="highlighter" size={size} fullWidth onPress={onContinue} />
      <Button title="Skip" variant="outline" size={size} fullWidth onPress={onSkip} />
    </ScrollView>
  );
}

function SuccessView({
  ageBand,
  pages,
  context,
  isExample,
  onStart,
  onReset,
}: {
  ageBand: AgeBand;
  pages: CapturePage[];
  context: CaptureContext;
  isExample: boolean;
  onStart: () => void;
  onReset: () => void;
}) {
  const size = buttonSizeForBand(ageBand);
  const title =
    context.assignment.trim() || context.subject.trim()
      ? [context.subject.trim(), context.assignment.trim()].filter(Boolean).join(' — ')
      : 'Your work is ready';

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
      {isExample ? (
        <Text variant="caption" tone="muted" className="rounded-control bg-surface-raised p-2 text-center">
          Example — practice worksheet
        </Text>
      ) : null}
      <Text className="font-sans text-title font-bold text-text">{title}</Text>
      <Text className="font-sans text-body text-text">
        {ageBand === 'young'
          ? `We keep your photo for ${MEDIA_TTL_DAYS} days, then delete it. The words we read stay to help your tutor.`
          : `Photos and recordings are kept for ${MEDIA_TTL_DAYS} days and then deleted. Transcripts and OCR text stay to support tutoring.`}
      </Text>
      {pages.length > 0 ? (
        <View className="flex-row flex-wrap gap-element">
          {pages
            .filter((p) => p.kind !== 'file' || looksLikeImage(p.uri))
            .map((p) => (
              <Image
                key={p.id}
                alt="Page thumbnail"
                src={p.uri}
                className="h-32 w-24 rounded-card"
              />
            ))}
        </View>
      ) : null}
      <Button title="Start with Natalie" variant="highlighter" size={size} fullWidth onPress={onStart} />
      <Button
        title="Start over"
        variant="outline"
        size={size}
        fullWidth
        onPress={onReset}
        aria-label="Start the capture over"
      />
      {context.stuck.trim() ? (
        <Text className="font-sans text-body text-text">Stuck on: {context.stuck}</Text>
      ) : null}
    </ScrollView>
  );
}

function UploadProcessView({
  ids,
  ageBand,
}: {
  ids: readonly string[];
  ageBand: AgeBand;
}) {
  const online = useOnline();
  const rows = useTransferTray((s) => s.rows.filter((r) => ids.includes(r.id)));
  const retry = useTransferTray((s) => s.retry);
  const young = ageBand === 'young' || ageBand === 'child';

  const phaseKey = useMemo(
    () => uploadPhaseKey(rows.map((r) => r.status), ids.length, online),
    [rows, ids.length, online],
  );

  const phaseLabels: Record<UploadPhaseKey, string> = {
    preparing: 'Preparing',
    uploading: 'Uploading',
    processing: 'Processing',
    ready: 'Ready',
    waiting: 'Waiting for connection',
    error: young ? 'Some pages need another try' : 'Some files didn’t send',
  };

  const body =
    phaseKey === 'error'
      ? young
        ? 'That’s okay. Tap Try again.'
        : 'No harm done — retry the files below whenever you’re ready.'
      : young
        ? 'We are sending your work. You can leave this screen and come back later.'
        : 'Your work is uploading. You can leave this screen or continue in the background.';

  return (
    <View className="flex-1 p-inset gap-stack">
      <Text className="font-sans text-title font-bold text-text">{phaseLabels[phaseKey]}</Text>
      <Text className="font-sans text-body text-text">{body}</Text>
      <ScrollView className="flex-1" contentContainerClassName="gap-element">
        {rows.map((r) => (
          <View
            key={r.id}
            className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised p-3"
          >
            <Text numberOfLines={1} className="flex-1 font-sans text-body text-text">
              {r.name}
            </Text>
            <Text variant="caption" tone="muted">
              {r.status === 'done'
                ? 'Ready'
                : r.status === 'failed'
                  ? online
                    ? 'This file didn’t send'
                    : 'Waiting for connection'
                  : r.status === 'uploading'
                    ? 'Uploading'
                    : r.status === 'processing'
                      ? 'Processing'
                      : 'Preparing'}
            </Text>
            {r.status === 'failed' && online ? (
              /* Per-file retry, never a batch restart (doc 30 §4). */
              <Button
                title="Try again"
                size="sm"
                variant="outline"
                onPress={() => retry(r.id)}
                aria-label={`Try sending ${r.name} again`}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function CaptureScreen({ ageBand = 'teen', isExample = false }: CaptureScreenProps) {
  const router = useRouter();
  const { setProblem } = useCaptureStore();
  const labels = captureLabelsForBand(ageBand);

  const [step, setStep] = useState<CaptureStep>('choose');
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [pages, setPages] = useState<CapturePage[]>([]);
  const [verifiedText, setVerifiedText] = useState('');
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [typed, setTyped] = useState('');
  const [context, setContext] = useState<CaptureContext>({
    subject: '',
    assignment: '',
    dueDate: '',
    stuck: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadIds, setUploadIds] = useState<string[] | null>(null);
  const size = buttonSizeForBand(ageBand);
  const transferRows = useTransferTray((s) => s.rows);

  const reset = () => {
    setStep('choose');
    setMode(null);
    setPages([]);
    setVerifiedText('');
    setRecording(null);
    setTyped('');
    setContext({ subject: '', assignment: '', dueDate: '', stuck: '' });
    setEditingId(null);
    setUploadIds(null);
  };

  const chooseMode = async (selected: CaptureMode) => {
    setMode(selected);

    if (selected === 'camera') {
      setStep('capture');
      return;
    }

    if (selected === 'photo-library') {
      const picked = await pickNoteImage();
      if (picked) {
        const processed = await stripExif(picked.uri);
        setPages([photoPage(processed.uri)]);
        setStep('review-pages');
      }
      return;
    }

    if (selected === 'file') {
      const file = await pickFile();
      if (file) {
        if (looksLikeImage(file.name)) {
          const processed = await stripExif(file.uri);
          setPages([imagePage(processed.uri)]);
        } else {
          setPages([{ ...filePage(file.uri), uri: file.uri }]);
        }
        setStep('review-pages');
      }
      return;
    }

    if (selected === 'type' || selected === 'voice') {
      setStep('capture');
    }
  };

  const handleCameraCapture = async (photo: { filePath: string }) => {
    const processed = await stripExif(photo.filePath);
    setPages((prev) => [...prev, photoPage(processed.uri)]);
    setStep('review-pages');
  };

  const addAnother = () => {
    setMode('camera');
    setStep('capture');
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const movePage = (id: string, delta: number) => {
    setPages((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return prev;
      const next = [...prev];
      const swap = index + delta;
      if (swap < 0 || swap >= next.length) return prev;
      const a = next[index];
      const b = next[swap];
      if (a === undefined || b === undefined) return prev;
      next[index] = b;
      next[swap] = a;
      return next;
    });
  };

  const beginReadVerify = () => {
    if (pages.length > 0 && (pages[0]?.kind === 'photo' || pages[0]?.kind === 'image')) {
      setStep('read-verify');
      return;
    }
    if (mode === 'type') {
      setStep('read-verify');
      return;
    }
    if (mode === 'voice' && recording) {
      setStep('read-verify');
      return;
    }
    // Files with no readable image skip straight to context.
    setStep('add-context');
  };

  const beginUpload = () => {
    if (pages.length === 0 && recording === null) {
      // Typed input has nothing to upload; skip straight to the success surface.
      setStep('success');
      return;
    }
    setStep('upload-process');
  };

  const startWithNatalie = () => {
    // The subject AddContext just collected travels with the problem —
    // downstream attribution needs it (contract note: the confirm exit must
    // carry subject context to learner.tutor).
    const fullProblem = [context.subject, context.assignment, context.stuck, verifiedText]
      .filter(Boolean)
      .join('\n\n');
    setProblem(fullProblem.trim() || verifiedText);
    router.push('/tutor');
  };

  // Enqueue captured media once the upload step is reached.
  useEffect(() => {
    if (step !== 'upload-process' || uploadIds !== null) return;

    const sessionId = newId();
    const ids: string[] = [];

    for (const [i, page] of pages.entries()) {
      const name =
        page.kind === 'photo'
          ? `photo-${i + 1}.jpg`
          : page.uri.split('/').pop() ?? `file-${i + 1}`;
      const mimeType =
        page.kind === 'photo' || page.kind === 'image' ? 'image/jpeg' : mimeForFile(name);

      useUploadQueue.getState().enqueue({
        id: page.id,
        uri: page.uri,
        name,
        mimeType,
        sessionId,
      });
      ids.push(page.id);
    }

    if (recording) {
      const id = newId();
      useUploadQueue.getState().enqueue({
        id,
        uri: recording.uri,
        name: 'voice-note.mp4',
        mimeType: 'audio/mp4',
        sessionId,
      });
      ids.push(id);
    }

    // Defer the state handoff so the effect does not trigger a synchronous
    // cascade; the upload flow is a state machine that advances on derived
    // readiness, not on user input.
    queueMicrotask(() => setUploadIds(ids));
    void drainNow();
  }, [step, pages, recording, uploadIds]);

  // Advance to success once every enqueued item is ready. The effect resolves
  // on done||failed: a batch with failures SETTLES on the upload step, where
  // the error phase offers a per-file retry — success only ever means every
  // page actually sent.
  useEffect(() => {
    if (step !== 'upload-process' || uploadIds === null) return;
    if (uploadIds.length === 0) {
      queueMicrotask(() => setStep('success'));
      return;
    }
    const ours = transferRows.filter((r) => uploadIds.includes(r.id));
    const settled =
      ours.length > 0 && ours.every((r) => r.status === 'done' || r.status === 'failed');
    if (settled && ours.every((r) => r.status === 'done')) {
      queueMicrotask(() => setStep('success'));
    }
  }, [step, uploadIds, transferRows]);

  // Contract cancel exit: back to the learner's home surface (learner.home).
  // '/' is the role dispatcher on both apps — the same door the error screen
  // uses — so it lands on the learner shell without hardcoding a tab path.
  const exitToHome = () => router.push('/');

  const stepBody = () => {
    if (step === 'choose') {
      /*
        flex-grow + justify-center: the choose body is short by design, and
        top-anchoring it stranded the options over a half-screen of dead
        whitespace on desktop. Centering the composed block spends the surplus
        symmetrically; when the content is taller than the viewport the
        ScrollView scrolls exactly as before.
      */
      const young = ageBand === 'young' || ageBand === 'child';
      return (
        <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-center p-inset gap-group">
          {isExample ? (
            <Text variant="caption" tone="muted" className="rounded-control bg-surface-raised p-2 text-center">
              Example — practice worksheet
            </Text>
          ) : null}
          <View className="gap-element">
            <Heading level={1} size={young ? 'display-md' : 'display-sm'}>
              {labels.heading}
            </Heading>
            <Text className="font-sans text-body text-text-muted">{labels.prompt}</Text>
          </View>
          <CaptureEntryRow ageBand={ageBand} onSelect={(m) => void chooseMode(m)} />
        </ScrollView>
      );
    }

    if (step === 'capture') {
      if (mode === 'camera') {
        return (
          <View className="flex-1">
            <GuidedFrame
              ageBand={ageBand}
              onCapture={async (photo) => {
                await handleCameraCapture(photo);
              }}
              onPickPhoto={() => void chooseMode('photo-library')}
              onBack={() => {
                setMode(null);
                setStep('choose');
              }}
            />
            <CaptureTip ageBand={ageBand} />
          </View>
        );
      }

      if (mode === 'type') {
        return (
          <TypeCapture
            ageBand={ageBand}
            onDone={(text) => {
              setTyped(text);
              setStep('read-verify');
            }}
          />
        );
      }

      if (mode === 'voice') {
        return (
          <VoiceCapture
            ageBand={ageBand}
            onDone={(r) => {
              setRecording(r);
              setStep('read-verify');
            }}
            onCancel={reset}
          />
        );
      }

      return null;
    }

    if (step === 'review-pages' && editingId !== null) {
      const page = pages.find((p) => p.id === editingId);
      if (page) {
        return (
          <CropPreview
            ageBand={ageBand}
            source={page.uri}
            onCrop={(uri) => {
              setPages((prev) => prev.map((p) => (p.id === editingId ? { ...p, uri } : p)));
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        );
      }
    }

    if (step === 'review-pages') {
      return (
        <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
          <Text className="font-sans text-title font-bold text-text">Review your pages</Text>
          <Text className="font-sans text-body text-text">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'} ready
          </Text>
          <View className="gap-element">
            {pages.map((page, index) => (
              <View
                key={page.id}
                className="flex-row items-center gap-element rounded-card border-2 border-border bg-surface-raised p-2"
              >
                {page.kind === 'photo' || page.kind === 'image' ? (
                  <Image alt="Page" src={page.uri} className="h-24 w-20 rounded-card" />
                ) : (
                  <View className="h-24 w-20 items-center justify-center rounded-card bg-surface-sunken">
                    <Text variant="caption" tone="muted" className="text-center">
                      {page.uri.split('/').pop() ?? 'File'}
                    </Text>
                  </View>
                )}
                <View className="flex-1 gap-1">
                  <Text className="font-sans text-body text-text">
                    Page {index + 1}
                  </Text>
                  <View className="flex-row gap-1">
                    <IconButton
                      icon={<ChevronUp size={18} />}
                      aria-label={`Move page ${index + 1} up`}
                      size="sm"
                      variant="outline"
                      onPress={() => movePage(page.id, -1)}
                      disabled={index === 0}
                    />
                    <IconButton
                      icon={<ChevronDown size={18} />}
                      aria-label={`Move page ${index + 1} down`}
                      size="sm"
                      variant="outline"
                      onPress={() => movePage(page.id, 1)}
                      disabled={index === pages.length - 1}
                    />
                    {page.kind !== 'file' ? (
                      <Button
                        title="Crop"
                        aria-label={`Crop page ${index + 1}`}
                        size="sm"
                        variant="outline"
                        onPress={() => setEditingId(page.id)}
                      />
                    ) : null}
                  </View>
                </View>
                <IconButton
                  icon={<X size={18} />}
                  aria-label={`Remove page ${index + 1}`}
                  size="sm"
                  variant="outline"
                  onPress={() => removePage(page.id)}
                />
              </View>
            ))}
          </View>
          <Button
            title="Add another page"
            variant="outline"
            size={size}
            fullWidth
            onPress={addAnother}
          />
          <Button
            title="Looks good — next step"
            variant="highlighter"
            size={size}
            fullWidth
            onPress={beginReadVerify}
            disabled={pages.length === 0}
          />
          <Button title="Start over" variant="ghost" size={size} fullWidth onPress={reset} />
        </ScrollView>
      );
    }

    if (step === 'read-verify') {
      const firstPage = pages[0];
      if (firstPage && (firstPage.kind === 'photo' || firstPage.kind === 'image')) {
        return (
          <OcrReview
            ageBand={ageBand}
            source={firstPage.uri}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('review-pages')}
          />
        );
      }

      if (mode === 'type') {
        return (
          <DigitizedTextReview
            ageBand={ageBand}
            initialText={typed}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('capture')}
          />
        );
      }

      if (mode === 'voice' && recording) {
        return (
          <VoiceReadVerify
            ageBand={ageBand}
            recording={recording}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('capture')}
          />
        );
      }

      return null;
    }

    if (step === 'add-context') {
      return (
        <AddContext
          ageBand={ageBand}
          context={context}
          onChange={setContext}
          onContinue={beginUpload}
          onSkip={beginUpload}
        />
      );
    }

    if (step === 'upload-process') {
      return <UploadProcessView ids={uploadIds ?? []} ageBand={ageBand} />;
    }

    return (
      <SuccessView
        ageBand={ageBand}
        pages={pages}
        context={context}
        isExample={isExample}
        onStart={startWithNatalie}
        onReset={reset}
      />
    );
  };

  /*
    Choose and success keep their surrounding chrome (tab bar / their own clear
    actions); every step in between is chrome-minimal, so it carries the
    contract's cancel exit itself — words for the young bands, a small X for
    the older ones.
  */
  const showCancel = step !== 'choose' && step !== 'success';

  /*
    ONE width cap for the whole journey (P0): every step used to pick its own
    wrapper, so desktop jumped between a centered column (choose/review) and
    full-bleed forms (type/voice/context/upload/success). The single Container
    at the step switch ends that. px-0 because each step owns its p-inset
    gutter — on phones max-w-content-form exceeds the viewport, so mobile
    renders exactly as before.
  */
  return (
    <SafeArea className="flex-1" edges={['top']}>
      <Container width="form" className="flex-1 px-0">
        {showCancel ? (
          <View className="flex-row justify-end px-inset pt-2">
            {ageBand === 'young' || ageBand === 'child' ? (
              <Button
                title="I'm done"
                variant="ghost"
                size={size}
                onPress={exitToHome}
                aria-label="Stop and go back home"
              />
            ) : (
              <IconButton
                icon={<X size={20} />}
                aria-label="Close and go back home"
                variant="ghost"
                size="md"
                onPress={exitToHome}
              />
            )}
          </View>
        ) : null}
        {stepBody()}
      </Container>
    </SafeArea>
  );
}
