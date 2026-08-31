'use client';
// Native online/offline detection. NetInfo is not currently wired, so the
// surface treats the device as online and lets the upload queue's retry/backoff
// surface real failures as it normally does.
// SOT: packages/app/features/media/TransferTray.tsx
// SOT-KEYWORDS: online offline network native
export function useOnline() {
  return true;
}
