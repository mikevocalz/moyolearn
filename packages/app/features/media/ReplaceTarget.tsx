'use client';
// The thing itself is the drop target (doc 30 §1). An avatar, logo, or
// cover image that already has a value gets no dashed rectangle: it accepts a
// drop, a click opens the picker, paste works for screenshots, and while the
// upload runs the NEW image shows optimistically from its local URI.
//
// Failure REVERTS to the previous image with an inline retry — the optimistic
// value snapping back IS the error message (doc 30 §8.1.7); never a broken
// image, never a blank circle.
//
// Transport is `useBunnyUpload`, doc 29's visible-progress state machine —
// this is the surface that hook was written for. Replace-keeps-history is the
// CALLER's half: `onReplaced` hands back the new object's key and the caller
// writes `replacedFrom`; this component never overwrites a path.
//
// Mobbin: https://mobbin.com/screens/eaf43a41-dda3-4d9c-886b-21160666710b (Workable — the current file is the control, "Replace file or drag and drop here" inline, no box) · https://mobbin.com/screens/b4b8871e-e48c-4937-a9cc-260e9401a567 (HoneyBook — single image replace states the size limit up front) · https://mobbin.com/screens/35939a24-39ba-41e1-b3c1-9f38c2a99187 (Magnific — rules printed under the target, not discovered by rejection). Structure only.
// SOT: docs/pack/30-upload-surfaces-spec.md §1, §6 · docs/pack/29-bunny-media-spec.md §3
// SOT-KEYWORDS: replace target avatar logo drop optimistic revert retry upload surface
import { Button, DropZone, FileTrigger, PasteWrapper, ProgressBar, Text, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { MAX_BYTES, type MediaKind, type PresignResult } from './media.types.ts';
import { useBunnyUpload } from './use-bunny-upload';
import { acceptForKinds, validateCandidates, type CandidateFile } from './upload-surfaces.shared.ts';
import { pickUploadFiles } from './pick-upload-files';
import { fileSize } from './file-size';

export interface ReplaceTargetProps {
  kind: MediaKind;
  /** Accessible name — "Replace profile photo", "Replace school logo". */
  label: string;
  /** The value on file, already signed for viewing by the caller. Null when none yet. */
  currentUrl: string | null;
  /**
   * Draws the target — the Avatar or Image the rest of the screen already
   * shows. Receives the display URL: the staged local URI while an upload
   * runs, the previous value the moment one fails.
   */
  renderPreview: (displayUrl: string | null) => React.ReactNode;
  /** The bytes landed. Persist the key and set `replacedFrom` — history, never overwrite. */
  onReplaced: (result: PresignResult, file: CandidateFile) => void | Promise<void>;
  className?: string;
}

interface ReplaceState {
  /** The file being (or last) uploaded — kept so retry re-sends the same pick. */
  staged: CandidateFile | null;
  hovering: boolean;
  /** What the live region last said. State, so re-renders don't re-announce. */
  announced: string;
}

export function ReplaceTarget({
  kind,
  label,
  currentUrl,
  renderPreview,
  onReplaced,
  className,
}: ReplaceTargetProps) {
  const store = useInstanceStore<ReplaceState>(() => ({ staged: null, hovering: false, announced: '' }));
  const staged = useStore(store, (s) => s.staged);
  const hovering = useStore(store, (s) => s.hovering);
  const announced = useStore(store, (s) => s.announced);
  const uploader = useBunnyUpload(kind);

  const announce = (message: string) => store.setState((s) => ({ ...s, announced: message }));

  const run = async (raw: CandidateFile) => {
    // A drop or a paste arrives without a byte count; the same measuring fork
    // the queue uses fills it in, so validation never calls a real file empty.
    const file = raw.size > 0 ? raw : { ...raw, size: await fileSize(raw.uri) };
    const [verdict] = validateCandidates([file]);
    if (verdict === undefined) return;
    if (!verdict.ok) {
      // Rejected before a byte moves; the previous image never even blinks.
      announce(verdict.reason);
      return;
    }
    store.setState((s) => ({ ...s, staged: file }));
    announce('Uploading…');
    const result = await uploader.upload(file);
    if (result !== null) {
      announce('Saved.');
      await onReplaced(result, file);
    } else {
      announce('That didn’t save — showing the previous image. Retry when ready.');
    }
  };

  const pick = async () => {
    const [file] = await pickUploadFiles({ kinds: [kind], multiple: false });
    if (file !== undefined) void run(file);
  };

  const failed = uploader.phase === 'error';
  // Revert-on-fail: the staged preview holds only while the upload is alive or landed.
  const displayUrl = failed ? currentUrl : (staged?.uri ?? currentUrl);
  const maxMb = Math.round(MAX_BYTES[kind] / (1024 * 1024));

  return (
    <View className={`gap-element self-start ${className ?? ''}`}>
      <DropZone
        bare
        active={hovering}
        onEnter={() => store.setState((s) => ({ ...s, hovering: true }))}
        onExit={() => store.setState((s) => ({ ...s, hovering: false }))}
        onDrop={({ assets }) => {
          store.setState((s) => ({ ...s, hovering: false }));
          const asset = assets[0];
          if (asset?.uri === undefined) return;
          void run({ uri: asset.uri, name: asset.fileName ?? 'dropped-file', type: asset.type, size: 0 });
        }}
      >
        <PasteWrapper
          onPaste={(payload) => {
            if (kind !== 'image' || payload.type !== 'images') return;
            const uri = payload.uris[0];
            // A pasted screenshot arrives typeless; PNG is what screenshots are.
            if (uri !== undefined) void run({ uri, name: 'pasted-image.png', type: 'image/png', size: 0 });
          }}
        >
          <FileTrigger
            label={label}
            accept={acceptForKinds([kind])}
            onFiles={([file]) => {
              if (file !== undefined) void run(file);
            }}
            onPickRequest={() => void pick()}
          >
            <View className="relative self-start">
              {renderPreview(displayUrl)}
              {/* The affordance rides ON the thing (Workable's shape). Always
                  visible rather than hover-only: touch has no hover, and an
                  affordance only mice can find fails doc 30 §6. */}
              <View className="absolute -bottom-1 -right-1 rounded-control border-2 border-border-strong bg-surface-raised px-2 py-0.5 shadow-card">
                <Text variant="caption" tone="muted">
                  {uploader.busy ? '…' : 'Replace'}
                </Text>
              </View>
            </View>
          </FileTrigger>
        </PasteWrapper>
      </DropZone>

      {/* The rule, stated before it is tested by failure (doc 30 §2). */}
      <Text variant="caption" tone="muted">{`Up to ${maxMb} MB`}</Text>

      {uploader.busy ? (
        <ProgressBar
          ratio={uploader.ratio}
          label={`Uploading ${staged?.name ?? 'file'}`}
          valueText={uploader.ratio === null ? null : `${Math.round(uploader.ratio * 100)}%`}
        />
      ) : null}

      {failed ? (
        <View className="flex-row items-center gap-element">
          <Text variant="caption" className="text-redpen">
            {uploader.error ?? 'That didn’t save.'}
          </Text>
          <Button
            title="Retry"
            variant="outline"
            size="sm"
            onPress={() => {
              const file = store.getState().staged;
              if (file !== null) void run(file);
            }}
          />
        </View>
      ) : null}

      {/* Screen-reader status (doc 30 §6): added, uploading, saved, reverted. */}
      {/* Collapsed, not display:none — a hidden live region never announces. */}
      <View aria-live="polite" accessibilityLiveRegion="polite" className="h-px w-px overflow-hidden opacity-0">
        <Text variant="caption">{announced}</Text>
      </View>
    </View>
  );
}
