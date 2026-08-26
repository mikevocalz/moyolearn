// Grow-with-content height for the composer field — native.
//
// On native the multiline TextInput already grows with its content, so there is
// nothing to measure and nothing to set. The web fork does the work; this exists
// so `Composer` can call one hook on both platforms instead of branching.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height native noop

/** Returns the ref to attach to the field. Native needs none. */
export function useAutoGrow(_value: string): { ref: undefined } {
  return { ref: undefined };
}
