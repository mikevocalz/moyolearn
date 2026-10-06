// The bridge between a mounted `AdaptivePanes` host and the shell chrome that
// draws its `PaneToggle`s. The host knows WHICH toggles exist (column count,
// inspector) but not where they live; the header knows where they should live
// but not whether a host is on screen. This store is the meeting point.
//
// Entries are keyed by the host screen's own `route.key` (react-navigation's
// per-screen-instance id), NOT by the global pathname: blurred tab screens stay
// mounted, and anything derived from "the current route" republishes wrongly
// the moment a blurred host re-renders — the key belongs to the screen, so it
// cannot drift. The header renders the controls only for the entry whose key
// is ITS OWN screen's key, so a blurred host's registration can never leak
// into another screen's bar — and a refocused screen needs no republish at
// all, because its entry was never cleared while it stayed mounted.
//
// SOT: ./index.tsx (publisher) · apps/mobile/components/ShellHeader.tsx (consumer)
// SOT-KEYWORDS: pane controls header bridge registration toggle route key
import { create } from 'zustand';

export interface PaneControlsRegistration {
  /** Instance id, so a late unmount cleanup cannot clear a newer host's entry. */
  owner: string;
  columnCount: 1 | 2;
  /** An inspector toggle exists (host passed both `showInspector` and content). */
  inspector: boolean;
}

interface PaneControlsState {
  entries: Record<string, PaneControlsRegistration>;
  /**
   * Mounted header consumers. While > 0, hosts skip their own in-pane row —
   * one mount site for one control, same rule `paneControls={false}` encodes
   * for TutorStage's toolbar. On surfaces with no header consumer (web pages,
   * Storybook) this stays 0 and the in-pane row renders exactly as before.
   */
  headerConsumers: number;
}

export const usePaneControlsStore = create<PaneControlsState>(() => ({
  entries: {},
  headerConsumers: 0,
}));

export function publishPaneControls(
  routeKey: string,
  registration: PaneControlsRegistration,
): void {
  const { entries } = usePaneControlsStore.getState();
  const existing = entries[routeKey];
  if (
    existing &&
    existing.owner === registration.owner &&
    existing.columnCount === registration.columnCount &&
    existing.inspector === registration.inspector
  ) {
    return;
  }
  usePaneControlsStore.setState({
    entries: { ...entries, [routeKey]: registration },
  });
}

export function clearPaneControls(routeKey: string, owner: string): void {
  const { entries } = usePaneControlsStore.getState();
  if (entries[routeKey]?.owner !== owner) return;
  const next = { ...entries };
  delete next[routeKey];
  usePaneControlsStore.setState({ entries: next });
}
