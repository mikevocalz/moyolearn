'use client';
// CaptureScreen — the six-stage homework-capture journey.
//
// The media layer underneath (queue, TUS, presign, retry, EXIF stripping)
// is unchanged. Only the learner-facing surface and the step vocabulary
// move to the "one confident journey" build prompt.
//
// Stages:
//   1. Choose how to share work
//   2. Capture (camera, photo library, file, type, voice)
//   3. Review pages (reorder, remove, crop, add another, confirm count)
//   4. Read and verify (OCR or transcript review, never low-confidence success)
//   5. Add context (subject, assignment, due date, stuck — all skippable)
//   6. Upload / process (Preparing, Uploading, Processing, Ready)
//   7. Success (thumbnails, title, privacy summary, one clear action)
// SOT: docs/pack/24-homework-capture-spec.md §1
// SOT-KEYWORDS: capture screen choose capture review verify context upload success age band

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'solito/navigation';
import { pickFile } from '../editor/pick-file';
import { pickNoteImage } from '../schedule/pick-note-image';
import {
  Button,
  Container,
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
    void transcribe(recording.uri).then((t) => {
      if (!cancelled) {
        setText(t);
        setPhase('ready');
      }
    });
    return () => { cancelled = true; };
  }, [recording.uri]);

  if (phase === 'loading') {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">
          {ageBand === 'young' ? 'Getting your words ready...' : 'Getting your words ready...'}
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
  return (
    <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
      <Text className="font-sans text-title font-bold text-text">
        {ageBand === 'young' ? 'Add a little info' : 'Add context (optional)'}
      </Text>
      <TextField
        label="Subject / class"
        value={context.subject}
        onChangeText={(subject) => onChange({ ...context, subject })}
      />
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
      : ageBand === 'young'
        ? 'Your work is ready'
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
        title={ageBand === 'young' ? 'Start over' : 'Start over'}
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
  const done = rows.filter((r) => r.status === 'done').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const active = rows.filter((r) => r.status !== 'done' && r.status !== 'failed');

  const phase: { key: 'preparing' | 'uploading' | 'processing' | 'ready'; label: string } = useMemo(() => {
    if (failed > 0 && !online) return { key: 'preparing', label: 'Waiting for connection' };
    if (done === ids.length && ids.length > 0) return { key: 'ready', label: 'Ready' };
    if (rows.some((r) => r.status === 'processing')) return { key: 'processing', label: 'Processing' };
    if (rows.some((r) => r.status === 'uploading')) return { key: 'uploading', label: 'Uploading' };
    return { key: 'preparing', label: 'Preparing' };
  }, [rows, ids.length, done, failed, online]);

  return (
    <View className="flex-1 p-inset gap-stack">
      <Text className="font-sans text-title font-bold text-text">{phase.label}</Text>
      <Text className="font-sans text-body text-text">
        {ageBand === 'young'
          ? 'We are sending your work. You can leave this screen and come back later.'
          : 'Your work is uploading. You can leave this screen or continue in the background.'}
      </Text>
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
    const fullProblem = [context.assignment, context.stuck, verifiedText]
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

  // Advance to success once every enqueued item is ready.
  useEffect(() => {
    if (step !== 'upload-process' || uploadIds === null) return;
    if (uploadIds.length === 0) {
      queueMicrotask(() => setStep('success'));
      return;
    }
    const ours = transferRows.filter((r) => uploadIds.includes(r.id));
    if (ours.length > 0 && ours.every((r) => r.status === 'done')) {
      queueMicrotask(() => setStep('success'));
    }
  }, [step, uploadIds, transferRows]);

  if (step === 'choose') {
    return (
      <SafeArea className="flex-1" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
          <Container className="gap-stack">
            {isExample ? (
              <Text variant="caption" tone="muted" className="rounded-control bg-surface-raised p-2 text-center">
                Example — practice worksheet
              </Text>
            ) : null}
            <Text className="font-sans text-title font-bold text-text">{labels.prompt}</Text>
            <CaptureEntryRow ageBand={ageBand} onSelect={(m) => void chooseMode(m)} />
          </Container>
        </ScrollView>
      </SafeArea>
    );
  }

  if (step === 'capture') {
    if (mode === 'camera') {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <View className="flex-1">
            <GuidedFrame
              ageBand={ageBand}
              onCapture={async (photo) => {
                await handleCameraCapture(photo);
              }}
            />
            <CaptureTip ageBand={ageBand} />
          </View>
        </SafeArea>
      );
    }

    if (mode === 'type') {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <TypeCapture
            ageBand={ageBand}
            onDone={(text) => {
              setTyped(text);
              setStep('read-verify');
            }}
          />
        </SafeArea>
      );
    }

    if (mode === 'voice') {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <VoiceCapture
            ageBand={ageBand}
            onDone={(r) => {
              setRecording(r);
              setStep('read-verify');
            }}
            onCancel={reset}
          />
        </SafeArea>
      );
    }

    return null;
  }

  if (step === 'review-pages' && editingId !== null) {
    const page = pages.find((p) => p.id === editingId);
    if (page) {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <CropPreview
            ageBand={ageBand}
            source={page.uri}
            onCrop={(uri) => {
              setPages((prev) => prev.map((p) => (p.id === editingId ? { ...p, uri } : p)));
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        </SafeArea>
      );
    }
  }

  if (step === 'review-pages') {
    return (
      <SafeArea className="flex-1" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="p-inset gap-stack">
          <Container className="gap-stack">
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
          </Container>
        </ScrollView>
      </SafeArea>
    );
  }

  if (step === 'read-verify') {
    const firstPage = pages[0];
    if (firstPage && (firstPage.kind === 'photo' || firstPage.kind === 'image')) {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <OcrReview
            ageBand={ageBand}
            source={firstPage.uri}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('review-pages')}
          />
        </SafeArea>
      );
    }

    if (mode === 'type') {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <DigitizedTextReview
            ageBand={ageBand}
            initialText={typed}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('capture')}
          />
        </SafeArea>
      );
    }

    if (mode === 'voice' && recording) {
      return (
        <SafeArea className="flex-1" edges={['top']}>
          <VoiceReadVerify
            ageBand={ageBand}
            recording={recording}
            onConfirm={(text) => {
              setVerifiedText(text);
              setStep('add-context');
            }}
            onCancel={() => setStep('capture')}
          />
        </SafeArea>
      );
    }

    return null;
  }

  if (step === 'add-context') {
    return (
      <SafeArea className="flex-1" edges={['top']}>
        <AddContext
          ageBand={ageBand}
          context={context}
          onChange={setContext}
          onContinue={beginUpload}
          onSkip={beginUpload}
        />
      </SafeArea>
    );
  }

  if (step === 'upload-process') {
    return (
      <SafeArea className="flex-1" edges={['top']}>
        <UploadProcessView ids={uploadIds ?? []} ageBand={ageBand} />
      </SafeArea>
    );
  }

  return (
    <SafeArea className="flex-1" edges={['top']}>
      <SuccessView
        ageBand={ageBand}
        pages={pages}
        context={context}
        isExample={isExample}
        onStart={startWithNatalie}
        onReset={reset}
      />
    </SafeArea>
  );
}
