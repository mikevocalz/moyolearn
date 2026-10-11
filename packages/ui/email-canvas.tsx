'use client';
// Browser-only presentation boundary for email HTML and HTML drag/drop. Nothing
// here authenticates, fetches, persists, or interprets the document model.
// SOT: docs/business/creative-studio.md · packages/ui/html/dom.web.tsx
// SOT-KEYWORDS: ui email preview sandbox draggable block download
import type { ReactNode } from 'react';
import { Button } from './Button';
const MIME = 'application/x-moyo-email-block';

export function EmailCanvas({ html, compact, showImages }: { html: string; compact: boolean; showImages: boolean }) {
  const csp = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${showImages ? 'https:' : "'none'"}; form-action 'none'; base-uri 'none'`;
  const document = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`)
    .replaceAll('<a ', '<a target="_blank" ');
  return <iframe title="Email design preview. Links are inactive." sandbox="" referrerPolicy="no-referrer"
    srcDoc={document} className={compact ? 'mx-auto min-h-screen w-full max-w-sm border-0' : 'min-h-screen w-full border-0'} />;
}

export function EmailBlockFrame({ id, label, disabled, onMoveBefore, children }: {
  id: string; label: string; disabled: boolean; onMoveBefore: (source: string, target: string) => void; children: ReactNode;
}) {
  return <section aria-label={label} className="gap-element rounded-card border border-border p-inset"
    onDragOver={(event) => { if (!disabled && event.dataTransfer.types.includes(MIME)) event.preventDefault(); }}
    onDrop={(event) => {
      if (disabled || !event.dataTransfer.types.includes(MIME)) return;
      event.preventDefault();
      onMoveBefore(event.dataTransfer.getData(MIME), id);
    }}>
    <span draggable={!disabled} title="Drag this block; Move up and Move down also work by touch or keyboard."
      className="inline-flex min-h-target-adult cursor-grab items-center text-sm text-text-muted"
      onDragStart={(event) => { event.dataTransfer.setData(MIME, id); event.dataTransfer.effectAllowed = 'move'; }}>
      Drag {label}
    </span>
    {children}
  </section>;
}

export function DownloadEmailDocument({ content, filename, title, disabled = false }: {
  content: string; filename: string; title: string; disabled?: boolean;
}) {
  return <Button title={title} variant="outline" disabled={disabled} onPress={() => {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.rel = 'noopener';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }} />;
}
