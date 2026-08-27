// Touch has no page-level drag (doc 30 §6) — constant false, so the shared
// component renders no drag acknowledgement and no drag copy on a phone.
// SOT-KEYWORDS: page drag native noop touch
export function usePageDrag(): boolean {
  return false;
}
