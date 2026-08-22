'use client';
// CaptureScreen — orchestrates the five homework-capture entry modes.
// SOT: docs/pack/24-homework-capture-spec.md §1
// SOT-KEYWORDS: capture screen homework camera photo file type voice preview

import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Button, Image, Text, Textarea, VoiceRecorder } from '@acme/ui';
import type { VoiceRecording } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { CaptureEntryRow } from './entry-row';
import { GuidedFrame } from './guided-frame';
import { CaptureMode, CapturePhoto, CaptureStep } from './types';

type CapturePayload =
  | { kind: 'none' }
  | { kind: 'photo'; photo: CapturePhoto }
  | { kind: 'image'; uri: string }
  | { kind: 'file'; name: string; uri: string }
  | { kind: 'text'; text: string }
  | { kind: 'voice'; recording: VoiceRecording };

function TypeCapture({ onDone }: { onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <View className="flex-1 gap-stack p-inset">
      <Textarea
        label="Type the problem"
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button title="Done" variant="highlighter" fullWidth onPress={() => onDone(text)} />
    </View>
  );
}

function Preview({ payload, onReset }: { payload: CapturePayload; onReset: () => void }) {
  let body: React.ReactNode;
  switch (payload.kind) {
    case 'photo':
      body = <Image alt="Captured work" src={`file://${payload.photo.filePath}`} className="h-64 w-full rounded-card" />;
      break;
    case 'image':
      body = <Image alt="Selected work" src={payload.uri} className="h-64 w-full rounded-card" />;
      break;
    case 'file':
      body = <Text className="font-sans text-body text-text">{payload.name}</Text>;
      break;
    case 'text':
      body = <Text className="font-sans text-body text-text">{payload.text}</Text>;
      break;
    case 'voice':
      body = (
        <Text className="font-sans text-body text-text">
          Voice recording: {Math.round(payload.recording.duration)}s
        </Text>
      );
      break;
    default:
      body = <Text className="font-sans text-body text-text">Nothing captured</Text>;
  }

  return (
    <View className="flex-1 gap-stack p-inset">
      {body}
      <Button title="Start over" variant="outline" fullWidth onPress={onReset} />
    </View>
  );
}

export function CaptureScreen() {
  const [step, setStep] = useState<CaptureStep>('entry');
  const [mode, setMode] = useState<CaptureMode | undefined>(undefined);
  const [payload, setPayload] = useState<CapturePayload>({ kind: 'none' });

  const reset = () => {
    setStep('entry');
    setMode(undefined);
    setPayload({ kind: 'none' });
  };

  const handleSelect = async (selected: CaptureMode) => {
    setMode(selected);

    if (selected === 'camera') {
      setStep('capture');
      return;
    }

    if (selected === 'photo-library') {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' });
      if (!result.canceled && result.assets[0]) {
        setPayload({ kind: 'image', uri: result.assets[0].uri });
        setStep('preview');
      }
      return;
    }

    if (selected === 'file') {
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPayload({ kind: 'file', name: asset.name, uri: asset.uri });
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
        <Text className="font-sans text-title font-bold text-text">
          How do you want to add your work?
        </Text>
        <CaptureEntryRow onSelect={(m) => void handleSelect(m)} />
      </View>
    );
  }

  if (step === 'capture') {
    if (mode === 'camera') {
      return (
        <GuidedFrame
          onCapture={(photo) => {
            setPayload({ kind: 'photo', photo });
            setStep('preview');
          }}
        />
      );
    }

    if (mode === 'type') {
      return <TypeCapture onDone={(text) => { setPayload({ kind: 'text', text }); setStep('preview'); }} />;
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

  return <Preview payload={payload} onReset={reset} />;
}
