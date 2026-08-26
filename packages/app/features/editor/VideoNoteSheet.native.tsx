'use client';
// Record a video note, upload it, hand the editor back something durable.
//
// Mobbin: https://mobbin.com/screens/2628c80f-1c35-45ef-b7e5-5d2a5ff9e81f (Hinge — elapsed and cap together, "0:00 / 0:30") · https://mobbin.com/screens/ca8f9728-a151-41d6-8b67-70fc8bbc46d1 (Snapchat — time remaining on the shutter) · https://mobbin.com/screens/1e1d7064-c2ec-4af9-974a-124f2b09ed6b (WhatsApp — stop is a shape inside the control) · https://mobbin.com/screens/68b1e9cc-c121-4340-859c-95a0806aa76d (ID — cancel kept distinct from stop) · https://mobbin.com/screens/bf73d135-48a5-42d7-9847-c4558450075c (CapCut — confirm beside the shutter)
//
// Structure from those five, aesthetics from none — they are consumer video
// apps and this is a tutoring tool.
//
// Mounted at the app ROOT, like the voice recorder and for the same reason: the
// editor sits inside a Gorhom bottom sheet, and a Modal mounted in there stops
// the sheet mounting its content at all.
//
// It resolves only once the bytes have LANDED. The recording, the upload, and
// the wait for Bunny to transcode all happen behind this one dialog, because
// the editor has no way to hold a half-finished video and a note must never be
// written pointing at a local path.
// SOT: packages/app/features/editor/video.store.ts · docs/pack/29 §4
// SOT-KEYWORDS: video note sheet recorder upload modal root editor capability
import { Modal } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Button, Text } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import { Video, X } from '@acme/ui/icons';
import {
  useVideoRecorder,
  useVideoUpload,
  VIDEO_MAX_SECONDS,
  formatClock,
} from '../media';
import { useVideoStore } from './video.store.ts';

export function VideoNoteSheet() {
  const open = useVideoStore((state) => state.open);
  const resolve = useVideoStore((state) => state.resolve);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => resolve(null)}>
      <View className="flex-1 items-center justify-center bg-ink-950/40 p-6">
        <View className="w-full max-w-md gap-5 overflow-hidden rounded-card border-2 border-border bg-surface-raised p-5 shadow-overlay">
          <View className="flex-row items-center gap-element">
            <Video size={20} className="text-accent" />
            <Text className="flex-1 text-lg font-semibold text-text md:text-xl">Video note</Text>
            <Pressable
              aria-label="Close"
              onPress={() => resolve(null)}
              className="h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
            >
              <X size={18} className="text-text-muted" />
            </Pressable>
          </View>

          {/* Remounted per opening, so a cancelled take leaves nothing behind. */}
          {open ? <VideoNoteBody /> : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * The recorder itself.
 *
 * Split out so the camera, the recorder, and the upload all unmount when the
 * dialog closes. A `<Camera isActive>` left mounted behind a hidden Modal holds
 * the capture session open and the indicator light on.
 */
function VideoNoteBody() {
  const resolve = useVideoStore((state) => state.resolve);
  const rec = useVideoRecorder();
  const up = useVideoUpload();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const send = async () => {
    if (!rec.filePath) return;
    const result = await up.upload(
      { uri: rec.filePath, name: 'video.mp4', type: 'video/mp4', size: 0 },
      `Video note · ${formatClock(rec.elapsed)}`,
    );
    if (result) {
      resolve({
        videoId: result.videoId,
        playbackUrl: result.playbackUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: rec.elapsed,
      });
    }
  };

  /*
    Permission is asked for when the user presses record, not on mount. A camera
    prompt that appears before anyone has said they want the camera is the
    prompt people deny — and iOS only ever asks once.
  */
  if (!hasPermission) {
    return (
      <View className="gap-stack">
        <Text className="text-body text-text">Moyo needs the camera to record a video note.</Text>
        <View className="flex-row items-center gap-stack">
          <Button title="Not now" variant="outline" onPress={() => resolve(null)} className="flex-1" />
          <Button title="Allow camera" onPress={() => void requestPermission()} className="flex-[2]" />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-stack">
      {/* The viewfinder, so the shot is framed before recording rather than
          discovered afterwards. */}
      <View className="aspect-video overflow-hidden rounded-card border-2 border-border-strong bg-ink-950">
        {device && rec.videoOutput ? (
          <Camera style={{ flex: 1 }} isActive device={device} outputs={[rec.videoOutput]} />
        ) : null}

        {rec.phase === 'recording' ? (
          <View className="absolute left-0 right-0 top-inset items-center">
            {/* Elapsed AND cap, in mono so the digits do not change width as
                they tick — a clock that reflows is one people stop reading. */}
            <View className="flex-row items-center gap-element rounded-control border-2 border-border-strong bg-surface px-inset-tight py-1">
              <View className="h-2 w-2 rounded-full bg-danger" />
              <Text className="font-mono text-data text-text">
                {formatClock(rec.elapsed)} / {formatClock(VIDEO_MAX_SECONDS)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {rec.phase === 'idle' ? (
        <>
          <Text variant="caption" tone="muted">
            Up to {formatClock(VIDEO_MAX_SECONDS)}. Recording stops on its own at the limit.
          </Text>
          <Button title="Record" onPress={() => void rec.start()} />
        </>
      ) : null}

      {rec.phase === 'recording' ? (
        <>
          {/* How much of the cap is left, on the control being pressed. */}
          <View className="h-1 w-full overflow-hidden rounded-full bg-ink-950/12">
            <View className="h-full rounded-full bg-danger" style={{ width: `${rec.ratio * 100}%` }} />
          </View>
          <View className="flex-row items-center gap-stack">
            {/* Discard throws the take away; stop keeps it. Two controls,
                because they are two intentions and one is destructive. */}
            <Button
              title="Discard"
              variant="ghost"
              onPress={() => {
                rec.reset();
                resolve(null);
              }}
              className="flex-1"
            />
            <Button title="Stop" variant="danger" onPress={() => void rec.stop()} className="flex-[2]" />
          </View>
        </>
      ) : null}

      {rec.phase === 'finished' ? (
        <>
          {rec.reason === 'max-duration-reached' ? (
            <Text variant="caption" tone="muted">
              Stopped at the {formatClock(VIDEO_MAX_SECONDS)} limit. The recording is complete.
            </Text>
          ) : null}
          {rec.reason === 'max-file-size-reached' ? (
            <Text variant="caption" tone="muted">
              Stopped at the size limit. The recording is complete.
            </Text>
          ) : null}

          {up.phase === 'uploading' ? (
            <>
              <View className="h-1 w-full overflow-hidden rounded-full bg-ink-950/12">
                <View className="h-full rounded-full bg-grade" style={{ width: `${(up.ratio ?? 0) * 100}%` }} />
              </View>
              <Text className="font-mono text-data text-text-muted">
                {Math.round((up.ratio ?? 0) * 100)}% uploaded{up.resumed ? ' · resumed' : ''}
              </Text>
              <Button title="Cancel upload" variant="ghost" onPress={up.cancel} />
            </>
          ) : null}

          {/* Processing is NOT a percentage. The bytes are gone and Bunny is
              transcoding; a bar sitting at 99% teaches people to distrust every
              bar shown afterwards. */}
          {up.phase === 'processing' ? (
            <Text className="text-body text-text-muted">Uploaded. Preparing the video…</Text>
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
        </>
      ) : null}

      {rec.phase === 'error' ? (
        <>
          <Text className="text-body text-danger">{rec.error}</Text>
          <Button title="Try again" onPress={() => void rec.start()} />
        </>
      ) : null}
    </View>
  );
}
