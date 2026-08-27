'use client';
// The detached transfer panel (doc 30 §1) — mounted once at app root, so it
// survives every navigation the uploads it reports outlive. It renders the
// module-level tray store, which mirrors the ONE persisted upload queue;
// nothing here transports bytes, and there is no parallel queue to drift.
//
// Per-file everything (doc 30 §4): its own bar with real bytes, its own
// status through doc 29 §4's two-phase model (`processing` is Bunny encoding,
// with no honest percentage, so the bar goes indeterminate rather than
// sitting at a 100% that looks stuck), and its own resume-retry — the queue
// makes one item due again, TUS keeps its fingerprint; nothing else restarts.
//
// Renders null with nothing to say — an empty tray is no tray at all.
//
// Mobbin: https://mobbin.com/screens/12f6528d-e78a-4540-9087-784c0baa9172 (Proton Drive — `7 uploading (0%)` header over All/Active/Completed/Failed tabs, per-file rows) · https://mobbin.com/screens/0e45d455-f884-44a9-8600-16830793250e (Fireflies — the smaller floating corner tray this minimizes into) · https://mobbin.com/screens/2a7be71f-2e9a-404c-9c56-c846d8616783 (Revolut Business — per-file status and adjacent value text on each row). Structure only.
// SOT: docs/pack/30-upload-surfaces-spec.md §1, §4 · docs/pack/29-bunny-media-spec.md §4
// SOT-KEYWORDS: transfer tray panel detached minimize tabs rows retry resume progress
import { Button, IconButton, ProgressBar, SegmentedControl, Text } from '@acme/ui';
import { Pressable, ScrollView, View } from '@acme/ui/tw';
import { Check, ChevronDown, ChevronUp } from '@acme/ui/icons';
import { useTransferTray } from './transfer-tray.store';
import {
  formatBytes,
  rowsForTab,
  trayTitle,
  TRAY_TABS,
  type TransferRow,
  type TrayTab,
} from './upload-surfaces.shared.ts';
import { FileGlyph } from './file-glyph';

const TAB_LABEL: Record<TrayTab, string> = {
  all: 'All',
  active: 'Active',
  completed: 'Done',
  failed: 'Failed',
};

/**
 * What the live region says. Counts only — no percentages, so it changes at
 * milestones (a row finishing, a row failing) rather than at every progress
 * event, which is the difference between a status and a heckler (doc 30 §6).
 */
const milestones = (rows: readonly TransferRow[]): string => {
  const active = rowsForTab(rows, 'active').length;
  const done = rowsForTab(rows, 'completed').length;
  const failed = rowsForTab(rows, 'failed').length;
  const parts: string[] = [];
  if (active > 0) parts.push(`${active} uploading`);
  if (done > 0) parts.push(`${done} done`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(', ');
};

function TrayRow({ row }: { row: TransferRow }) {
  const retry = useTransferTray((s) => s.retry);
  const ratio =
    row.bytesTotal !== null && row.bytesTotal > 0 ? row.bytesSent / row.bytesTotal : null;
  return (
    <View className="flex-row items-center gap-element border-b border-border py-2">
      <FileGlyph name={row.name} mimeType={row.mimeType} />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-sm font-medium md:text-base">
          {row.name}
        </Text>
        {row.status === 'queued' ? (
          <Text variant="caption" tone="muted">
            Waiting to upload
          </Text>
        ) : null}
        {row.status === 'uploading' ? (
          <ProgressBar
            ratio={ratio}
            label={`Uploading ${row.name}`}
            valueText={
              row.bytesTotal !== null && row.bytesTotal > 0
                ? `${formatBytes(row.bytesSent)} / ${formatBytes(row.bytesTotal)}`
                : null
            }
          />
        ) : null}
        {row.status === 'processing' ? (
          // Phase 2 (doc 29 §4): bytes landed, Bunny is encoding. No honest
          // percentage exists, so the bar says "moving, amount unknown".
          <ProgressBar ratio={null} label={`Processing ${row.name}`} valueText="Processing" />
        ) : null}
        {row.status === 'failed' ? (
          <Text variant="caption" className="text-redpen">
            {row.error ?? 'This file didn’t send.'}
          </Text>
        ) : null}
      </View>
      {row.status === 'done' ? (
        <View className="flex-row items-center gap-1">
          <Check size={16} className="text-grade" aria-hidden />
          <Text variant="caption" tone="muted">
            Done
          </Text>
        </View>
      ) : null}
      {row.status === 'failed' ? (
        // Resume, not restart: the queue re-dues this one item and the drain
        // only runs due items; TUS video continues from the server's offset.
        <Button title="Retry" variant="outline" size="sm" onPress={() => retry(row.id)} />
      ) : null}
    </View>
  );
}

export interface TransferTrayProps {
  /** Placement override — the default docks it to the host's bottom corner. */
  className?: string;
}

export function TransferTray({ className }: TransferTrayProps) {
  const rows = useTransferTray((s) => s.rows);
  const tab = useTransferTray((s) => s.tab);
  const minimized = useTransferTray((s) => s.minimized);
  const setTab = useTransferTray((s) => s.setTab);
  const setMinimized = useTransferTray((s) => s.setMinimized);
  const clearCompleted = useTransferTray((s) => s.clearCompleted);

  const title = trayTitle(rows);
  if (title === null) return null;

  const visible = rowsForTab(rows, tab);
  const doneCount = rowsForTab(rows, 'completed').length;

  return (
    <View
      aria-label="File transfers"
      accessibilityLabel="File transfers"
      className={`absolute bottom-inset right-inset z-50 w-96 max-w-full ${className ?? ''}`}
    >
      {minimized ? (
        // The Fireflies corner pill: one honest line, tap to reopen.
        <Pressable
          role="button"
          aria-label={`Expand file transfers — ${title}`}
          onPress={() => setMinimized(false)}
          className="flex-row items-center gap-element self-end rounded-control border-2 border-border bg-surface-raised px-4 py-3 shadow-card"
        >
          <Text className="text-sm font-medium md:text-base">{title}</Text>
          <ChevronUp size={16} className="text-text-muted" aria-hidden />
        </Pressable>
      ) : (
        <View className="gap-stack rounded-sheet border-2 border-border bg-surface-raised p-inset shadow-card">
          <View className="flex-row items-center gap-element">
            <Text className="flex-1 font-semibold">{title}</Text>
            {doneCount > 0 ? (
              <Button title="Clear done" variant="ghost" size="sm" onPress={clearCompleted} />
            ) : null}
            <IconButton
              icon={<ChevronDown size={18} />}
              aria-label="Minimize file transfers"
              onPress={() => setMinimized(true)}
            />
          </View>

          <SegmentedControl<TrayTab>
            options={TRAY_TABS.map((key) => ({
              value: key,
              label: `${TAB_LABEL[key]} (${rowsForTab(rows, key).length})`,
            }))}
            value={tab}
            onChange={setTab}
          />

          {visible.length === 0 ? (
            <Text variant="caption" tone="muted" className="py-2 text-center">
              Nothing {tab === 'all' ? 'here' : TAB_LABEL[tab].toLowerCase()} right now.
            </Text>
          ) : (
            // Mapped inside a capped scroll, not virtualized: the tray holds a
            // batch, and a fixed-height virtual container for three rows reads
            // broken. The cap keeps a big batch from eating the screen.
            <ScrollView className="max-h-96">
              {visible.map((row) => (
                <TrayRow key={row.id} row={row} />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Milestone announcements only — counts change, percentages don't speak. */}
      <View
        aria-live="polite"
        accessibilityLiveRegion="polite"
        className="h-px w-px overflow-hidden opacity-0"
      >
        <Text variant="caption">{milestones(rows)}</Text>
      </View>
    </View>
  );
}
