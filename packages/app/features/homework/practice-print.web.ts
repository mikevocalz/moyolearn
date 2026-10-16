// The browser prints from the authenticated route, which re-checks the
// guardianship and the approval before it serves a byte. A new tab keeps the
// preview where the adult left it.
// SOT: docs/work/pr-100/contract.md §Routes · apps/web/app/api/guardian/practice-sets/[practiceSetId]/print/route.ts
// SOT-KEYWORDS: practice print web route window open sheet key
import { API_URL } from '../../core/api-url.ts';
import { practicePrintPath } from './homework.client.ts';
import type { PrintPracticeSet } from './practice-print.types.ts';

export { practicePrintPath } from './homework.client.ts';

export const printPracticeSet: PrintPracticeSet = async (set, mode) => {
  if (typeof window === 'undefined') return 'unavailable';
  // No `noopener`: with it, window.open returns null even on success, and a
  // blocked pop-up would be indistinguishable from an opened one.
  const opened = window.open(`${API_URL}${practicePrintPath(set.practiceSetId, mode)}`, '_blank');
  return opened === null ? 'unavailable' : 'shared';
};
