// Native printing renders the shared HTML to a PDF on device, then hands the
// file to the share sheet, where AirPrint, Files, Mail and Drive all live.
// Rendering locally keeps the answer key off any URL: the set the screen
// already holds is the set that prints. expo-print and expo-sharing are Expo
// modules, so nothing here needs a Nitro module or a native target of our own.
// SOT: docs/work/pr-100/contract.md §Practice sets · packages/app/features/homework/practice-sheet-html.ts
// SOT-KEYWORDS: practice print native expo-print printToFileAsync expo-sharing shareAsync pdf letter
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { practiceSheetHtml, PRACTICE_KEY_LABEL, PRACTICE_SHEET_LABEL } from './practice-sheet-html.ts';
import type { PrintPracticeSet } from './practice-print.types.ts';

/* US Letter in PostScript points; the sheet's @page rule assumes it. */
const LETTER = { width: 612, height: 792 } as const;

export const printPracticeSet: PrintPracticeSet = async (set, mode) => {
  if (!(await isAvailableAsync())) return 'unavailable';
  const { uri } = await printToFileAsync({ html: practiceSheetHtml(set, mode), ...LETTER });
  await shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: mode === 'sheet' ? PRACTICE_SHEET_LABEL : PRACTICE_KEY_LABEL,
  });
  return 'shared';
};
