// TS RESOLUTION ANCHOR — the same extensionless-fork trick as
// `pane-overrides.store.ts` and `use-split-view-back.ts`: Metro picks the
// `.native` file, every other bundler gets `.web`. The web fork must stay
// free of react-navigation — see `use-split-view-back.native.ts` for why the
// router cannot enter the web module graph.
// SOT-KEYWORDS: pane controls route key fork anchor
export { usePaneRouteKey } from './use-pane-route-key.web';
