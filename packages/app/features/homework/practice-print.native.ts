// Native printing renders the shared HTML to a PDF on device, then hands the
// file to the share sheet, where AirPrint, Files, Mail and Drive all live.
// Fetching the authenticated print route re-checks current guardianship and
// approval before creating a PDF. Cached preview data cannot authorize export.
// expo-print and expo-sharing are Expo modules; no separate native target.
// SOT: docs/work/pr-100/contract.md §Practice sets · packages/app/features/homework/practice-sheet-html.ts
// SOT-KEYWORDS: practice print native expo-print printToFileAsync expo-sharing shareAsync pdf letter
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { PRACTICE_KEY_LABEL, PRACTICE_SHEET_LABEL } from './practice-sheet-html.ts';
import { loadPracticePrintHtml } from './homework.client.ts';
import type { PrintPracticeSet } from './practice-print.types.ts';

/* US Letter in PostScript points; the sheet's @page rule assumes it. */
const LETTER = { width: 612, height: 792 } as const;

export const printPracticeSet: PrintPracticeSet = async (set, mode) => {
  if (!(await isAvailableAsync())) return 'unavailable';
  const html = await loadPracticePrintHtml(set.practiceSetId, mode);
  const { uri } = await printToFileAsync({ html, ...LETTER });
  await shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: mode === 'sheet' ? PRACTICE_SHEET_LABEL : PRACTICE_KEY_LABEL,
  });
  return 'shared';
};
