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
import type { UploadReporter } from './upload-queue.shared.ts';

type Drain = (onUploaded: UploadReporter) => Promise<void>;
let drain: Drain | undefined;
let listening = false;

/*
  Nobody to tell. A drain fired by the `online` listener has no call stack to
  return a URL to, and the app may not have mounted a reporter yet — so the
  absent case is a function that does nothing, not a missing argument. An
  upload that lands while nothing is listening is still an upload that landed.
*/
const unreported: UploadReporter = () => {};
let report: UploadReporter | undefined;

export const UPLOAD_TASK = 'moyo-media-upload';

export function setUploadDrain(fn: Drain): void {
  drain = fn;
}

/** Where finished uploads go. Optional: see `unreported` above. */
export function setUploadReporter(fn: UploadReporter): void {
  report = fn;
}

/**
 * Reports a completed upload to whoever registered interest, if anyone.
 *
 * Exported so a caller that drives its own drain — the provider, when an item
 * is enqueued mid-session — reports through the SAME reporter the platform
 * drains use, rather than closing over one at mount. Reading it at fire time is
 * the point: the drain that matters may run hours after registration.
 */
export function reportUpload(completed: Parameters<UploadReporter>[0]): void {
  (report ?? unreported)(completed);
}

export async function registerUploadDrain(): Promise<void> {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // `online` rather than a timer: retrying on a dead network burns battery to
  // learn what the browser already knows.
  window.addEventListener('online', () => void drain?.(report ?? unreported));
  await drain?.(report ?? unreported);
}

export async function unregisterUploadDrain(): Promise<void> {
  // Listener removal is deliberately not implemented: the drain is idempotent
  // and the page unload takes it anyway. A no-op that says why beats an
  // unregister that pretends to a symmetry the platform does not have.
}
