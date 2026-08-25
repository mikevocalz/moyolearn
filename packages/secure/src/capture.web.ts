// PLATFORM FORK — the browser offers no capture prevention, and saying so beats
// a no-op that reads like protection.
//
// There is no FLAG_SECURE equivalent on the web and no app-switcher thumbnail to
// blur. §2.5's protections are a native guarantee; the web surfaces that need
// them (payment entry, the internal support view) rely on §3's Payload admin
// hardening and on not rendering child data there in the first place.
// SOT: docs/pack/07-security-spec.md §2.5
// SOT-KEYWORDS: screen capture web unavailable noop browser

export type CaptureGuard = 'payment' | 'support' | 'learner-shell' | 'family-shell';

export function useScreenCaptureGuard(_tag: CaptureGuard): void {
  // Intentionally nothing: the browser has no capture-prevention API.
}
