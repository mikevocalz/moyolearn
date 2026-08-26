'use client';
// Record a video note, then upload it.
//
// Mobbin: https://mobbin.com/screens/2628c80f-1c35-45ef-b7e5-5d2a5ff9e81f (Hinge — elapsed AND cap together, "0:00 / 0:30") · https://mobbin.com/screens/ca8f9728-a151-41d6-8b67-70fc8bbc46d1 (Snapchat — ring around the shutter for time remaining) · https://mobbin.com/screens/1e1d7064-c2ec-4af9-974a-124f2b09ed6b (WhatsApp — stop is a shape INSIDE the shutter, not a second button) · https://mobbin.com/screens/68b1e9cc-c121-4340-859c-95a0806aa76d (ID — cancel kept visually distinct from stop) · https://mobbin.com/screens/bf73d135-48a5-42d7-9847-c4558450075c (CapCut — confirm sits beside the shutter, not replacing it)
//
// Structure from those five, aesthetics from none — they are consumer video
// apps and this is a tutoring tool.
//
// The three decisions that matter:
//
// 1. THE CAP IS ON SCREEN BEFORE YOU PRESS RECORD. `0:00 / 3:00` from the first
//    frame, plus a ring that drains as you speak. A limit discovered when you
//    hit it is a limit discovered too late.
// 2. STOP AND CANCEL ARE DIFFERENT CONTROLS. Stop keeps the recording; cancel
//    throws it away. Collapsing them into one button behind a confirm dialog is
//    how people lose takes.
// 3. UPLOAD AND PROCESSING ARE DIFFERENT PHASES. The bar finishes when the bytes
//    land; the wait afterwards is Bunny transcoding and has no honest
//    percentage, so it says what it is instead of pretending to be 99%.
// SOT: packages/app/features/media/use-video-recorder.ts · doc 29 §4
// SOT-KEYWORDS: video note sheet recorder upload progress camera bunny stream
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Button, Text } from '@acme/ui';
import { View, Pressable } from '@acme/ui/tw';
import { useVideoRecorder } from './use-video-recorder';
import { useVideoUpload } from './use-video-upload';
import { VIDEO_MAX_SECONDS, formatClock } from './video-note.constants.ts';

export interface VideoNoteSheetProps {
  /** Resolves with the playback URL once Bunny has finished encoding. */
  onComplete: (video: { playbackUrl: string; thumbnailUrl: string; videoId: string }) => void;
  onCancel: () => void;
}

export function VideoNoteSheet({ onComplete, onCancel }: VideoNoteSheetProps) {
  const rec = useVideoRecorder();
  const up = useVideoUpload();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const send = async () => {
    if (!rec.filePath) return;
    await up.upload(
      {
        uri: rec.filePath,
        name: 'video.mp4',
        type: 'video/mp4',
        size: 0,
      },
      `Video note · ${formatClock(rec.elapsed)}`,
    );
  };

  if (up.phase === 'processing' && up.playbackUrl && up.thumbnailUrl && up.videoId) {
    onComplete({ playbackUrl: up.playbackUrl, thumbnailUrl: up.thumbnailUrl, videoId: up.videoId });
  }

  return (
    <View className="flex-1 gap-group bg-surface p-inset">
      {/* The viewfinder. Present from the first render so the user frames the
          shot before recording rather than discovering the angle afterwards. */}
      <View className="flex-1 overflow-hidden rounded-card border-2 border-border-strong bg-ink-950">
        {device && rec.videoOutput ? (
          <Camera style={{ flex: 1 }} isActive device={device} outputs={[rec.videoOutput]} />
        ) : null}

        {rec.phase === 'recording' ? (
          <View className="absolute left-0 right-0 top-inset items-center">
            {/*
              Elapsed AND cap, in mono so the digits do not jump width as they
              tick — a clock that reflows is a clock people stop reading.
            */}
            <View className="flex-row items-center gap-element rounded-control border-2 border-border-strong bg-surface px-inset-tight py-1">
              <View className="h-2 w-2 rounded-full bg-danger" />
              <Text className="font-mono text-data text-text">
                {formatClock(rec.elapsed)} / {formatClock(VIDEO_MAX_SECONDS)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/*
        Permission is requested when the user asks to record, not on mount.
        A camera prompt that appears before anyone has said they want the camera
        is the prompt people deny — and iOS only ever asks once.
      */}
      {rec.phase === 'idle' && !hasPermission ? (
        <View className="gap-stack">
          <Text className="text-body text-text">Moyo needs the camera to record a video note.</Text>
          <View className="flex-row items-center gap-stack">
            <Button title="Not now" variant="outline" onPress={onCancel} className="flex-1" />
            <Button title="Allow camera" onPress={() => void requestPermission()} className="flex-[2]" />
          </View>
        </View>
      ) : null}

      {rec.phase === 'idle' && hasPermission ? (
        <View className="gap-stack">
          <Text className="text-caption text-text-muted">
            Up to {formatClock(VIDEO_MAX_SECONDS)}. Recording stops on its own at the limit.
          </Text>
          <View className="flex-row items-center gap-stack">
            <Button title="Cancel" variant="outline" onPress={onCancel} className="flex-1" />
            <Button title="Record" onPress={() => void rec.start()} className="flex-[2]" />
          </View>
        </View>
      ) : null}

      {rec.phase === 'recording' ? (
        <View className="gap-stack">
          {/* The ring: how much of the cap is left, on the control being pressed. */}
          <View className="h-1 w-full overflow-hidden rounded-full bg-ink-950/12">
            <View className="h-full rounded-full bg-danger" style={{ width: `${rec.ratio * 100}%` }} />
          </View>
          <View className="flex-row items-center gap-stack">
            {/* Cancel discards. Stop keeps. Two controls, because they are two
                intentions and one of them is destructive. */}
            <Button
              title="Discard"
              variant="ghost"
              onPress={() => {
                rec.reset();
                onCancel();
              }}
              className="flex-1"
            />
            <Button title="Stop" variant="danger" onPress={() => void rec.stop()} className="flex-[2]" />
          </View>
        </View>
      ) : null}

      {rec.phase === 'finished' ? (
        <View className="gap-stack">
          {rec.reason === 'max-duration-reached' ? (
            <Text className="text-caption text-text-muted">
              Stopped at the {formatClock(VIDEO_MAX_SECONDS)} limit. The recording is complete.
            </Text>
          ) : null}
          {rec.reason === 'max-file-size-reached' ? (
            <Text className="text-caption text-text-muted">
              Stopped at the size limit. The recording is complete.
            </Text>
          ) : null}

          {up.phase === 'uploading' ? (
            <>
              <View className="h-1 w-full overflow-hidden rounded-full bg-ink-950/12">
                <View className="h-full rounded-full bg-grade" style={{ width: `${(up.ratio ?? 0) * 100}%` }} />
              </View>
              <Text className="font-mono text-data text-text-muted">
                {Math.round((up.ratio ?? 0) * 100)}% uploaded
                {up.resumed ? ' · resumed' : ''}
              </Text>
              <Button title="Cancel upload" variant="ghost" onPress={up.cancel} />
            </>
          ) : null}

          {/*
            Processing is NOT a percentage. The bytes are gone; Bunny is
            transcoding, and the only honest thing to show is that it is
            happening and that leaving is safe.
          */}
          {up.phase === 'processing' ? (
            <Text className="text-body text-text-muted">
              Uploaded. Preparing the video — you can leave this screen.
            </Text>
          ) : null}

          {up.phase === 'error' ? (
            <>
              <Text className="text-body text-danger">{up.error}</Text>
              <Button title="Try again" onPress={() => void send()} />
            </>
          ) : null}

          {up.phase === 'idle' ? (
            <View className="flex-row items-center gap-stack">
              <Button title="Re-record" variant="outline" onPress={rec.reset} className="flex-1" />
              <Button title="Use this" onPress={() => void send()} className="flex-[2]" />
            </View>
          ) : null}
        </View>
      ) : null}

      {rec.phase === 'error' ? (
        <View className="gap-stack">
          <Text className="text-body text-danger">{rec.error}</Text>
          <Button title="Try again" onPress={() => void rec.start()} />
        </View>
      ) : null}
    </View>
  );
}
