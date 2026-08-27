'use client';
// The one-to-many upload surface (doc 30 §1): a bordered zone with the rules
// printed INSIDE it before first interaction, a per-file verdict list below,
// and a primary button that counts reality — `Upload 0 files`, disabled,
// never an enabled button that will fail (doc 30 §2–§3, the Whop pattern).
//
// Files it accepts join the ONE persisted upload queue and surface in the
// TransferTray — this component stages and validates, it never transports.
// Validation happens on drop via the same `assertUploadable` rulebook the
// presign route enforces, so the zone cannot accept what the server rejects.
//
// The visible zone is a `<label>` for a REAL `<input type="file">` (the kit's
// FileTrigger), so Tab reaches it and Enter/Space opens the picker; on touch
// the tap opens the platform picker and the copy fork never mentions drag.
// Removal has an undo, because drag-and-drop is inaccurate by nature and
// recovery is part of the design (doc 30 §4).
//
// Mobbin: https://mobbin.com/screens/03fc821c-eec1-4278-bf97-8f8ac202d34c (Whop — per-row inline reasons and a footer that counts both fixable and invalid) · https://mobbin.com/screens/0e45d455-f884-44a9-8600-16830793250e (Fireflies — types AND per-type ceilings stated inside the zone) · https://mobbin.com/screens/50bd3a40-45f3-44a4-a9da-fe935dffefe1 (Lindy — compact zone with the rule sentence in caption under the title) · https://mobbin.com/screens/591d4424-f134-42bb-954f-2f8d1b188936 (Chatbase — bulk list with per-row remove under one primary action). Structure only.
// SOT: docs/pack/30-upload-surfaces-spec.md §1–§6 · docs/pack/29-bunny-media-spec.md §3
// SOT-KEYWORDS: upload dropzone surface zone rules verdict rows queue enqueue undo
import {
  Button,
  DropZone,
  FileTrigger,
  IconButton,
  PasteWrapper,
  Text,
  useInstanceStore,
  useStore,
} from '@acme/ui';
import { View } from '@acme/ui/tw';
import { CloudUpload, X } from '@acme/ui/icons';
import type { MediaKind } from './media.types.ts';
import {
  acceptForKinds,
  primaryAction,
  validateCandidates,
  verdictSummary,
  zoneRules,
  formatBytes,
  type CandidateFile,
  type FileVerdict,
} from './upload-surfaces.shared.ts';
import { useUploadQueue } from './upload-queue.store';
import { drainNow } from './upload-queue';
import { pickUploadFiles } from './pick-upload-files';
import { fileSize } from './file-size';
import { usePageDrag } from './use-page-drag';
import { ZONE_HINT, ZONE_TITLE } from './dropzone-copy';
import { FileGlyph } from './file-glyph';

export interface UploadDropzoneProps {
  kinds: readonly MediaKind[];
  /**
   * What the queued uploads are filed under — the queue's grouping key, the
   * same one homework captures use. One queue, one set of rules (doc 30 §8.2).
   */
  sessionId: string;
  /** Accessible name for the picker control. */
  label?: string;
  /**
   * The batch has left for the queue; ids are the queue's (and the tray's).
   * Progress from here on is the TransferTray's story, not this component's.
   */
  onEnqueued?: (ids: readonly string[]) => void;
  className?: string;
}

interface DropzoneState {
  verdicts: FileVerdict[];
  /** drag-over-zone (doc 30 §5) — driven by the zone's own enter/exit. */
  hovering: boolean;
  /** The last removal, held for undo. A new removal replaces it. */
  removed: { verdict: FileVerdict; index: number } | null;
  /** What the live region last said. State, so re-renders don't re-announce. */
  announced: string;
}

export function UploadDropzone({
  kinds,
  sessionId,
  label = 'Upload files',
  onEnqueued,
  className,
}: UploadDropzoneProps) {
  const store = useInstanceStore<DropzoneState>(() => ({
    verdicts: [],
    hovering: false,
    removed: null,
    announced: '',
  }));
  const verdicts = useStore(store, (s) => s.verdicts);
  const hovering = useStore(store, (s) => s.hovering);
  const removed = useStore(store, (s) => s.removed);
  const announced = useStore(store, (s) => s.announced);
  // drag-over-page (doc 30 §5): a drag anywhere over the window lights the
  // zone up, because a small target on a large screen is hard to hit.
  const pageDrag = usePageDrag();

  const announce = (message: string) => store.setState((s) => ({ ...s, announced: message }));

  const add = async (raw: readonly CandidateFile[]) => {
    if (raw.length === 0) return;
    // A drop or a paste arrives without a byte count; the same measuring fork
    // the queue uses fills it in, so validation never calls a real file empty.
    const measured = await Promise.all(
      raw.map(async (file) => (file.size > 0 ? file : { ...file, size: await fileSize(file.uri) })),
    );
    const next = validateCandidates(measured);
    store.setState((s) => ({ ...s, verdicts: [...s.verdicts, ...next], removed: null }));
    const invalid = next.filter((v) => !v.ok).length;
    announce(
      invalid === 0
        ? `${next.length} ${next.length === 1 ? 'file' : 'files'} added.`
        : `${next.length} added — ${invalid} can’t be uploaded.`,
    );
  };

  const pick = async () => {
    const files = await pickUploadFiles({ kinds, multiple: true });
    void add(files);
  };

  const removeAt = (index: number) => {
    const verdict = store.getState().verdicts[index];
    if (verdict === undefined) return;
    store.setState((s) => ({
      ...s,
      verdicts: s.verdicts.filter((_, i) => i !== index),
      removed: { verdict, index },
    }));
    announce(`Removed ${verdict.file.name}.`);
  };

  const undoRemove = () => {
    const last = store.getState().removed;
    if (last === null) return;
    store.setState((s) => {
      const verdicts = [...s.verdicts];
      verdicts.splice(Math.min(last.index, verdicts.length), 0, last.verdict);
      return { ...s, verdicts, removed: null };
    });
    announce(`Restored ${last.verdict.file.name}.`);
  };

  const send = () => {
    const staged = store.getState().verdicts.filter((v) => v.ok);
    if (staged.length === 0) return;
    const ids = staged.map((v) => {
      const id = globalThis.crypto.randomUUID();
      useUploadQueue
        .getState()
        .enqueue({ id, uri: v.file.uri, name: v.file.name, mimeType: v.file.type, sessionId });
      return id;
    });
    // Invalid rows stay staged: their problems are still the user's next task.
    store.setState((s) => ({ ...s, verdicts: s.verdicts.filter((v) => !v.ok), removed: null }));
    announce(
      `${ids.length} ${ids.length === 1 ? 'file' : 'files'} uploading — progress is in the transfer tray.`,
    );
    void drainNow();
    onEnqueued?.(ids);
  };

  const action = primaryAction(verdicts);
  const summary = verdictSummary(verdicts);
  const title = hovering ? 'Release to add files' : pageDrag ? 'Drop them here' : ZONE_TITLE;

  return (
    <View className={`gap-stack ${className ?? ''}`}>
      <DropZone
        active={hovering || pageDrag}
        onEnter={() => store.setState((s) => ({ ...s, hovering: true }))}
        onExit={() => store.setState((s) => ({ ...s, hovering: false }))}
        onDrop={({ assets }) => {
          store.setState((s) => ({ ...s, hovering: false }));
          void add(
            // A text-only drop carries no uri — there is nothing to upload.
            assets.flatMap<CandidateFile>((asset) =>
              asset.uri === undefined
                ? []
                : [{ uri: asset.uri, name: asset.fileName ?? 'dropped-file', type: asset.type, size: 0 }],
            ),
          );
        }}
      >
        <PasteWrapper
          onPaste={(payload) => {
            if (!kinds.includes('image') || payload.type !== 'images') return;
            // A pasted screenshot arrives typeless; PNG is what screenshots are.
            void add(
              payload.uris.map((uri, i) => ({
                uri,
                name: i === 0 ? 'pasted-image.png' : `pasted-image-${i + 1}.png`,
                type: 'image/png',
                size: 0,
              })),
            );
          }}
        >
          <FileTrigger
            label={label}
            accept={acceptForKinds(kinds)}
            multiple
            onFiles={(files) => void add(files)}
            onPickRequest={() => void pick()}
          >
            <View className="items-center gap-stack">
              <View className="h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-raised shadow-card">
                <CloudUpload size={28} className="text-text-muted" />
              </View>
              <Text className="text-center font-semibold">{title}</Text>
              <Text variant="caption" tone="muted" className="text-center">
                {ZONE_HINT}
              </Text>
              {/* The law (doc 30 §2): every type and ceiling, stated inside the
                  zone BEFORE the user tests them by failure. */}
              <Text variant="caption" tone="muted" className="text-center">
                {zoneRules(kinds)}
              </Text>
            </View>
          </FileTrigger>
        </PasteWrapper>
      </DropZone>

      {verdicts.length > 0 ? (
        <View className="gap-element">
          {verdicts.map((verdict, index) => (
            <View
              key={`${verdict.file.uri}-${index}`}
              className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised p-2"
            >
              <FileGlyph name={verdict.file.name} mimeType={verdict.file.type} />
              <View className="flex-1 gap-0.5">
                <Text numberOfLines={1} className="text-sm font-medium md:text-base">
                  {verdict.file.name}
                </Text>
                {verdict.ok ? (
                  <Text variant="data" tone="muted">
                    {formatBytes(verdict.file.size)}
                  </Text>
                ) : (
                  // The row's own reason, in the server's own sentence —
                  // never a blanket "Upload failed" (doc 30 §3). redpen:
                  // this row is actually wrong, not merely needs-attention.
                  <Text variant="caption" className="text-redpen">
                    {verdict.reason}
                  </Text>
                )}
              </View>
              <IconButton
                icon={<X size={18} />}
                aria-label={`Remove ${verdict.file.name}`}
                onPress={() => removeAt(index)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {removed !== null ? (
        <View className="flex-row items-center gap-element">
          <Text variant="caption" tone="muted" className="flex-1" numberOfLines={1}>
            Removed {removed.verdict.file.name}
          </Text>
          <Button title="Undo" variant="outline" size="sm" onPress={undoRemove} />
        </View>
      ) : null}

      {verdicts.length > 0 ? (
        <View className="flex-row items-center gap-element">
          <View className="flex-1">
            {summary !== null ? (
              <Text variant="caption" className="text-redpen">
                {summary}
              </Text>
            ) : null}
          </View>
          <Button title={action.label} disabled={!action.enabled} onPress={send} />
        </View>
      ) : null}

      {/* Screen-reader status (doc 30 §6): file added, verdicts, batch sent. */}
      {/* Collapsed, not display:none — a hidden live region never announces. */}
      <View
        aria-live="polite"
        accessibilityLiveRegion="polite"
        className="h-px w-px overflow-hidden opacity-0"
      >
        <Text variant="caption">{announced}</Text>
      </View>
    </View>
  );
}
