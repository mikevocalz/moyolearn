import { questionPages } from './question-pages.ts';
import type { XrPanelRow } from './XrTriPanel.types.ts';

/** Newest turn first, with each turn's text still read top-to-bottom. */
export function xrCaptionRows(
  messages: readonly { id: string; role: string; text: string }[],
  tutorName: string,
): XrPanelRow[] {
  return messages.slice().reverse().flatMap((message) => [
    { id: `${message.id}-speaker`, text: message.role === 'tutor' ? tutorName : 'You', emphasis: true },
    ...questionPages(message.text, 16, 1).map((text, i) => ({ id: `${message.id}-${i}`, text })),
  ]);
}
