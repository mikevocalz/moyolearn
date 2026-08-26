// Shared contract for the ops view state that belongs in the URL.
// SOT-KEYWORDS: ops view params url search state shareable contract
import type { LeadsView } from './use-leads';

/** The slice of the view that is worth putting in a URL. */
export type ShareableView = Pick<
  LeadsView,
  'q' | 'stage' | 'onlyAttention' | 'sortField' | 'sortDesc' | 'cursor'
>;

export interface ViewParams {
  view: ShareableView;
  /** Patch the view. Any change other than `cursor` resets the cursor. */
  setView: (patch: Partial<ShareableView>) => void;
}
