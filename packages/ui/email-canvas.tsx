'use client';
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
