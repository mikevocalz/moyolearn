// Draining the upload queue on web.
//
// A browser tab has no equivalent of a background task: it cannot ask the OS to
// wake it later, and Background Sync is Chromium-only and requires a service
// worker this app does not ship. So the honest web behaviour is narrower and
// says so — drain when the page loads, and drain when the network comes back.
//
// That covers the case that actually happens: wi-fi drops mid-upload, comes
// back a minute later, and the tab is still open. It does NOT cover a closed
// tab, and no amount of API wishing changes that.
// SOT-KEYWORDS: upload queue web drain online listener offline
type Drain = () => Promise<void>;
let drain: Drain | undefined;
let listening = false;

export const UPLOAD_TASK = 'moyo-media-upload';

export function setUploadDrain(fn: Drain): void {
  drain = fn;
}

export async function registerUploadDrain(): Promise<void> {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // `online` rather than a timer: retrying on a dead network burns battery to
  // learn what the browser already knows.
  window.addEventListener('online', () => void drain?.());
  await drain?.();
}

export async function unregisterUploadDrain(): Promise<void> {
  // Listener removal is deliberately not implemented: the drain is idempotent
  // and the page unload takes it anyway. A no-op that says why beats an
  // unregister that pretends to a symmetry the platform does not have.
}
