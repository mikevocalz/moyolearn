// Network presence for upload surfaces. A platform fork because the web and
// native runtimes expose this through different globals.
// SOT: packages/app/features/media/TransferTray.tsx
// SOT-KEYWORDS: online offline network connection presence upload
export { useOnline } from './use-online.web';
