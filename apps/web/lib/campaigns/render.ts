// Standalone, table-based email output. App CSS and canvas pixels do not travel
// with an email. The caller supplies semantic theme colors from @acme/theme.
// SOT: docs/business/creative-studio.md · Mailcheap lib/render-email.js
// SOT-KEYWORDS: business campaign email HTML renderer unsubscribe accessibility
import { CampaignInputError, parseDocument, type CampaignDocument } from './document.ts';

export const MAX_EMAIL_BYTES = 90_000;
export const UNSUBSCRIBE = '{{unsubscribe_url}}';
export const EMAIL_LAYOUT = { width: 600, inset: 24, bodySize: 16, headingSize: 28, footerSize: 13 } as const;
export type EmailTheme = Readonly<{ surface: string; text: string; primary: string; onPrimary: string }>;
export type EmailBrand = Readonly<{ name: string; postalAddress: string }>;

export function escapeHtml(value: string) {
  // Entity-encode braces as well: authored text cannot inject Mailcheap macros.
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');
}

export function renderCampaign(input: CampaignDocument, brand: EmailBrand, theme: EmailTheme) {
  const document = parseDocument(JSON.stringify(input));
  if (!brand.name.trim() || !brand.postalAddress.trim()) throw new CampaignInputError('A business name and postal address are required.');
  for (const color of Object.values(theme)) {
    if (!/^#[0-9a-f]{6}$/iu.test(color)) throw new CampaignInputError('Email colors must be resolved theme tokens.');
  }
  const layout = EMAIL_LAYOUT;
  const rows = document.blocks.map((block) => {
    let content: string;
    switch (block.kind) {
      case 'heading': content = `<h2 style="margin:0;font-size:${layout.headingSize}px;line-height:1.25;">${escapeHtml(block.text)}</h2>`; break;
      case 'paragraph': content = `<p style="margin:0;line-height:1.65;">${escapeHtml(block.text).replaceAll('\n', '<br>')}</p>`; break;
      case 'image': content = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="${layout.width - 2 * layout.inset}" style="display:block;width:100%;max-width:100%;height:auto;border:0;">`; break;
      case 'button': content = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${theme.primary}" style="padding:12px 20px;"><a href="${escapeHtml(block.href)}" style="color:${theme.onPrimary};font-weight:bold;text-decoration:underline;">${escapeHtml(block.label)}</a></td></tr></table>`; break;
      case 'divider': content = '<hr>'; break;
    }
    return `<tr><td style="padding:0 ${layout.inset}px ${layout.inset}px;">${content}</td></tr>`;
  }).join('');
  // Mailcheap replaces this token per recipient. Its HTML path otherwise adds
  // another footer; including ours keeps the configured business identity locked.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.subject)}</title></head><body style="margin:0;background:${theme.surface};color:${theme.text};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${layout.width}px;table-layout:fixed;word-wrap:break-word;font-family:Arial,Helvetica,sans-serif;font-size:${layout.bodySize}px;color:${theme.text};"><tr><td style="padding:${layout.inset}px;"><h1 style="font-size:${layout.bodySize}px;margin:0;">${escapeHtml(brand.name)}</h1></td></tr>${rows}<tr><td style="padding:${layout.inset}px;font-size:${layout.footerSize}px;line-height:1.6;"><div data-email-only>${escapeHtml(brand.name)}<br>${escapeHtml(brand.postalAddress)}<br><a href="${UNSUBSCRIBE}" style="color:${theme.text};text-decoration:underline;">Unsubscribe from marketing emails</a></div></td></tr></table></td></tr></table></body></html>`;
  if (new TextEncoder().encode(html).length > MAX_EMAIL_BYTES) throw new CampaignInputError('The rendered email is too large. Shorten the content.');
  return html;
}
