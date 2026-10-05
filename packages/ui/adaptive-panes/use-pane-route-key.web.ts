// PLATFORM FORK — web. No react-navigation on this side of the fork, so the
// registration has no screen key. Harmless: no header consumer mounts on web
// today, so nothing reads it; if a web chrome consumer ever lands, give this
// the web router's current-route identity then.
// SOT-KEYWORDS: pane controls route key web fork
export function usePaneRouteKey(): string | null {
  return null;
}
