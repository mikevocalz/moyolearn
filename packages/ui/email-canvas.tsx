'use client';
// Mobbin: https://mobbin.com/screens/415e7505-2142-4aff-b5fd-00aa3bd4ff95 (Square: message canvas beside a drag-and-drop block palette).
// Mobbin: https://mobbin.com/screens/19ef9213-d903-404f-bee7-c0ed7f27d124 (Klaviyo: a bounded email canvas with desktop/mobile preview controls).
// Mobbin: https://mobbin.com/screens/d6b97b83-341b-4031-b67c-48208d1d5243 (Pipedrive: content blocks and preview controls surrounding the message canvas).
// Review-time structural audit of the existing wrapper; styling stays in Moyo tokens.
// Email editor composites use the existing semantic kit. Browser document
// isolation/download effects live in the narrowly scoped platform primitive.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: ui email canvas preview semantic reorder download
import { Button } from './Button';
import { IsolatedEmailDocument, downloadEmailDocument } from './html/email-document.web';
export { EmailBlockFrame, EmailReorderGroup } from './email-reorder.web';
// Explicit extension: the web fork is the component, not this pure reducer.
export { reorderEmailItems } from './email-reorder.ts';
export function EmailCanvas(props: { html: string; compact: boolean; showImages: boolean }) {
  return <IsolatedEmailDocument {...props} />;
}
export function DownloadEmailDocument({ content, filename, title, disabled = false }: {
  content: string; filename: string; title: string; disabled?: boolean;
}) {
  return <Button title={title} variant="outline" disabled={disabled} onPress={() => downloadEmailDocument(content, filename)} />;
}
