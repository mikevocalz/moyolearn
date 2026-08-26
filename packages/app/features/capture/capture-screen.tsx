'use client';
// CaptureScreen — orchestrates the five homework-capture entry modes.
// SOT: docs/pack/24-homework-capture-spec.md §1
// SOT-KEYWORDS: capture screen homework camera photo file type voice preview ocr review age band

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
// The universal pickers, not the native modules directly: expo-image-picker has
// no web build and dragging it into the Next graph fails the build. Both forks
// already exist for exactly this reason — see pick-note-image.web's header.
import { pickFile } from '../editor/pick-file';
import { pickNoteImage } from '../schedule/pick-note-image';
import { Button, Image, Text, Textarea, VoiceRecorder } from '@acme/ui';
import type { VoiceRecording } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { CaptureEntryRow } from './entry-row';
import { GuidedFrame } from './guided-frame';
import { DigitizedTextReview } from './digitized-text-review';
import { OcrReview } from './ocr-review';
import { CropPreview } from './crop-preview';
import { useCaptureStore } from './capture.store';
import { buttonSizeForBand, captureLabelsForBand, type AgeBand } from './age-band';
import { stripExif } from './privacy-process';
import { CaptureMode, CapturePhoto, CaptureStep } from './types';

type CapturePayload =
  | { kind: 'none' }
  | { kind: 'photo'; photo: CapturePhoto }
  | { kind: 'image'; uri: string }
  | { kind: 'file'; name: string; uri: string }
  | { kind: 'text'; text: string }
  | { kind: 'voice'; recording: VoiceRecording };

function TypeCapture({ ageBand, onDone }: { ageBand: AgeBand; onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  const size = buttonSizeForBand(ageBand);
  const label = ageBand === 'young' ? 'Type the problem' : 'Type the problem';
  return (
    <View className="flex-1 gap-stack p-inset">
      <Textarea
        label={label}
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button title="Done" variant="highlighter" size={size} fullWidth onPress={() => onDone(text)} />
    </View>
  );
}

function Preview({
  ageBand,
  payload,
  onReset,
  onReview,
  onConfirm,
}: {
  ageBand: AgeBand;
  payload: CapturePayload;
  onReset: () => void;
  onReview: () => void;
  onConfirm: (text: string) => void;
}) {
  const size = buttonSizeForBand(ageBand);
  let body: React.ReactNode;
  let action: React.ReactNode = null;

  switch (payload.kind) {
    case 'photo':
      body = <Image alt="Captured work" src={payload.photo.filePath} className="h-64 w-full rounded-card" />;
      action = <Button title="Crop & review" variant="highlighter" size={size} fullWidth onPress={onReview} />;
      break;
    case 'image':
      body = <Image alt="Selected work" src={payload.uri} className="h-64 w-full rounded-card" />;
      action = <Button title="Crop & review" variant="highlighter" size={size} fullWidth onPress={onReview} />;
      break;
    case 'file':
      body = <Text className="font-sans text-body text-text">{payload.name}</Text>;
      action = <Button title="Use this file" variant="highlighter" size={size} fullWidth onPress={() => onConfirm(payload.name)} />;
      break;
    case 'text':
      body = <Text className="font-sans text-body text-text">{payload.text}</Text>;
      action = <Button title="Review text" variant="highlighter" size={size} fullWidth onPress={onReview} />;
      break;
    case 'voice':
      body = (
        <Text className="font-sans text-body text-text">
          Voice recording: {Math.round(payload.recording.duration)}s
        </Text>
      );
      action = (
        <Button
          title="Use this recording"
          variant="highlighter"
          size={size}
          fullWidth
          onPress={() => onConfirm('Voice recording')}
        />
      );
      break;
    default:
      body = <Text className="font-sans text-body text-text">Nothing captured</Text>;
  }

  return (
    <View className="flex-1 gap-stack p-inset">
      {body}
      {action}
      <Button title="Start over" variant="outline" size={size} fullWidth onPress={onReset} />
    </View>
  );
}

export interface CaptureScreenProps {
  ageBand?: AgeBand;
}

export function CaptureScreen({ ageBand = 'teen' }: CaptureScreenProps) {
  const router = useRouter();
  const { setProblem } = useCaptureStore();
  const [step, setStep] = useState<CaptureStep>('entry');
  const [mode, setMode] = useState<CaptureMode | undefined>(undefined);
  const [payload, setPayload] = useState<CapturePayload>({ kind: 'none' });

  const labels = captureLabelsForBand(ageBand);

  const reset = () => {
    setStep('entry');
    setMode(undefined);
    setPayload({ kind: 'none' });
  };

  const handleConfirm = (text: string) => {
    setProblem(text);
    router.push('/tutor');
  };

  const handleSelect = async (selected: CaptureMode) => {
    setMode(selected);

    if (selected === 'camera') {
      setStep('capture');
      return;
    }

    if (selected === 'photo-library') {
      const picked = await pickNoteImage();
      if (picked) {
        const processed = await stripExif(picked.uri);
        setPayload({ kind: 'image', uri: processed.uri });
        setStep('preview');
      }
      return;
    }

    if (selected === 'file') {
      const file = await pickFile();
      if (file) {
        setPayload({ kind: 'file', name: file.name, uri: file.uri });
        setStep('preview');
      }
      return;
    }

    if (selected === 'type' || selected === 'voice') {
      setStep('capture');
    }
  };

  if (step === 'entry') {
    return (
      <View className="flex-1 justify-center p-inset gap-stack">
        <Text className="font-sans text-title font-bold text-text">{labels.prompt}</Text>
        <CaptureEntryRow ageBand={ageBand} onSelect={(m) => void handleSelect(m)} />
      </View>
    );
  }

  if (step === 'capture') {
    if (mode === 'camera') {
      return (
        <GuidedFrame
          ageBand={ageBand}
          onCapture={async (photo) => {
            const processed = await stripExif(photo.filePath);
            setPayload({ kind: 'photo', photo: { filePath: processed.uri } });
            setStep('preview');
          }}
        />
      );
    }

    if (mode === 'type') {
      return <TypeCapture ageBand={ageBand} onDone={(text) => { setPayload({ kind: 'text', text }); setStep('preview'); }} />;
    }

    if (mode === 'voice') {
      return (
        <View className="flex-1 p-inset gap-stack">
          <VoiceRecorder
            onComplete={(recording) => { setPayload({ kind: 'voice', recording }); setStep('preview'); }}
            onCancel={reset}
            className="flex-1"
          />
        </View>
      );
    }

    return null;
  }

  if (step === 'review') {
    if (payload.kind === 'photo') {
      return (
        <OcrReview
          ageBand={ageBand}
          source={payload.photo.filePath}
          onConfirm={handleConfirm}
          onCancel={() => setStep('preview')}
        />
      );
    }

    if (payload.kind === 'image') {
      return (
        <OcrReview
          ageBand={ageBand}
          source={payload.uri}
          onConfirm={handleConfirm}
          onCancel={() => setStep('preview')}
        />
      );
    }

    if (payload.kind === 'text') {
      return (
        <DigitizedTextReview
          ageBand={ageBand}
          initialText={payload.text}
          onConfirm={handleConfirm}
          onCancel={() => setStep('preview')}
        />
      );
    }

    return null;
  }

  if (step === 'crop') {
    if (payload.kind === 'photo') {
      return (
        <CropPreview
          ageBand={ageBand}
          source={payload.photo.filePath}
          onCrop={(uri) => { setPayload({ kind: 'image', uri }); setStep('review'); }}
          onCancel={() => setStep('preview')}
        />
      );
    }

    if (payload.kind === 'image') {
      return (
        <CropPreview
          ageBand={ageBand}
          source={payload.uri}
          onCrop={(uri) => { setPayload({ kind: 'image', uri }); setStep('review'); }}
          onCancel={() => setStep('preview')}
        />
      );
    }

    return null;
  }

  return (
    <Preview
      ageBand={ageBand}
      payload={payload}
      onReset={reset}
      onReview={() => setStep(payload.kind === 'photo' || payload.kind === 'image' ? 'crop' : 'review')}
      onConfirm={handleConfirm}
    />
  );
}
