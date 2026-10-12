'use client';
// PLATFORM PRIMITIVE: the opaque document browsing context and file-download
// side effect have no semantic RNW equivalent. No app chrome or drag handlers.
// SOT: docs/business/semantic-gestures.md · packages/ui/html/dom.web.tsx
// SOT-KEYWORDS: semantic primitive isolated email document download browser geometry
import type { EmailRowRect } from '../email-reorder';
import { emailPreviewDocument } from '../email-document-policy';

export function IsolatedEmailDocument({ html, compact, showImages }: { html: string; compact: boolean; showImages: boolean }) {
  return <iframe title="Email design preview. Links are inactive." sandbox="" referrerPolicy="no-referrer"
    srcDoc={emailPreviewDocument(html, showImages)}
    className={compact ? 'mx-auto min-h-screen w-full max-w-sm border-0' : 'min-h-screen w-full border-0'} />;
}

export function downloadEmailDocument(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  try {
    anchor.href = url; anchor.download = filename; anchor.rel = 'noopener';
    document.body.appendChild(anchor); anchor.click();
  } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1_000); }
}

export function readEmailRows(scope: string, ids: readonly string[]): readonly EmailRowRect[] {
  const rows: EmailRowRect[] = [];
  for (const id of ids) {
    const node = document.getElementById(`${scope}-${id}`);
    if (!node) return [];
    const { left, top, width, height } = node.getBoundingClientRect();
    rows.push({ id, left, top, width, height });
  }
  return rows;
}

export function watchEmailInteraction(cancel: () => void): () => void {
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
  window.addEventListener('blur', cancel);
  window.addEventListener('resize', cancel);
  window.addEventListener('scroll', cancel, true);
  window.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', cancel);
  return () => {
    window.removeEventListener('blur', cancel);
    window.removeEventListener('resize', cancel);
    window.removeEventListener('scroll', cancel, true);
    window.removeEventListener('keydown', key);
    document.removeEventListener('visibilitychange', cancel);
  };
}
