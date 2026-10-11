// Versioned email document, not a raster artboard. No identity, recipient list,
// arbitrary HTML, or delivery command may enter this format.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign newsletter document blocks validation export
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };
export const MAX_DOCUMENT_BYTES = 65_536;
export const MAX_BLOCKS = 30;
export const BLOCK_KINDS = ['heading', 'paragraph', 'image', 'button', 'divider'] as const;

export class CampaignInputError extends Error {}

export function jsonObject(value: Json) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CampaignInputError('Expected a JSON object.');
  }
  return value;
}

export function readJson(source: string): Json {
  try { return JSON.parse(source); }
  catch { throw new CampaignInputError('The document is not valid JSON.'); }
}

function onlyKeys(value: ReturnType<typeof jsonObject>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new CampaignInputError('The document contains unsupported fields.');
  }
}

export function text(value: Json | undefined, name: string, max: number, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new CampaignInputError(`${name} must contain ${allowEmpty ? '0' : '1'}–${max} characters.`);
  }
  // Newlines are useful in prose; other control characters are not.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new CampaignInputError(`${name} contains control characters.`);
  }
  return value;
}

export function httpsUrl(value: Json | undefined, name: string) {
  const raw = text(value, name, 2_048);
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new CampaignInputError(`${name} must be an absolute HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password || /[\s\\]/u.test(raw)) {
    throw new CampaignInputError(`${name} must be an HTTPS URL without credentials or whitespace.`);
  }
  return url.href;
}

function parseBlock(value: Json, draft: boolean) {
  const block = jsonObject(value);
  const id = text(block.id, 'Block ID', 80);
  if (!/^[a-zA-Z0-9_-]+$/u.test(id)) throw new CampaignInputError('Invalid block ID.');
  switch (block.kind) {
    case 'heading':
      onlyKeys(block, ['id', 'kind', 'text']);
      return { id, kind: 'heading' as const, text: text(block.text, 'Heading', 200, draft) };
    case 'paragraph':
      onlyKeys(block, ['id', 'kind', 'text']);
      return { id, kind: 'paragraph' as const, text: text(block.text, 'Paragraph', 2_000, draft) };
    case 'image':
      onlyKeys(block, ['id', 'kind', 'src', 'alt']);
      return { id, kind: 'image' as const, src: draft ? text(block.src, 'Image URL', 2_048, true) : httpsUrl(block.src, 'Image URL'), alt: text(block.alt, 'Image description', 300, draft) };
    case 'button':
      onlyKeys(block, ['id', 'kind', 'href', 'label']);
      return { id, kind: 'button' as const, href: draft ? text(block.href, 'Button URL', 2_048, true) : httpsUrl(block.href, 'Button URL'), label: text(block.label, 'Button label', 80, draft) };
    case 'divider':
      onlyKeys(block, ['id', 'kind']);
      return { id, kind: 'divider' as const };
    default:
      throw new CampaignInputError('Unsupported email block.');
  }
}

function readDocument(source: string, draft: boolean) {
  if (new TextEncoder().encode(source).length > MAX_DOCUMENT_BYTES) {
    throw new CampaignInputError('The editable document exceeds 64 KiB.');
  }
  const value = jsonObject(readJson(source));
  onlyKeys(value, ['version', 'subject', 'previewText', 'blocks']);
  if (value.version !== 1) throw new CampaignInputError('Unsupported email document version.');
  const subject = text(value.subject, 'Subject', 200, draft);
  if (/[\r\n]/u.test(subject)) throw new CampaignInputError('Subject must be a single line.');
  const previewText = text(value.previewText, 'Preview text', 300, true);
  if (!Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > MAX_BLOCKS) {
    throw new CampaignInputError(`Use between 1 and ${MAX_BLOCKS} email blocks.`);
  }
  const blocks = value.blocks.map((block) => parseBlock(block, draft));
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new CampaignInputError('Each block must have a unique ID.');
  }
  if (!draft && blocks.every((block) => block.kind === 'divider')) {
    throw new CampaignInputError('Add some text, an image, or a button.');
  }
  return { version: 1 as const, subject, previewText, blocks };
}
// Editable saves may contain unfinished fields; exported email may not.
export function parseDocument(source: string) { return readDocument(source, false); }
export function parseEditableDocument(source: string) { return readDocument(source, true); }
// Downloads use the same bounded representation accepted by restore. Pretty
// printing can push a valid near-limit document over the restore byte budget.
export function serializeEditableDocument(document: ReturnType<typeof parseDocument>): string {
  return JSON.stringify(parseEditableDocument(JSON.stringify(document)));
}
export type CampaignDocument = ReturnType<typeof parseDocument>;
export type CampaignBlock = CampaignDocument['blocks'][number];

export function newDocument(): CampaignDocument {
  return {
    version: 1,
    subject: 'News from our tutoring team',
    previewText: 'Learning resources, upcoming classes, and community news.',
    blocks: [
      { id: 'welcome', kind: 'heading', text: 'A little news from our team' },
      { id: 'intro', kind: 'paragraph', text: 'Share your upcoming classes, useful learning resources, or a community announcement here.' },
    ],
  };
}

export function newBlock(kind: CampaignBlock['kind'], id: string): CampaignBlock {
  switch (kind) {
    case 'heading': return { id, kind, text: 'Your headline' };
    case 'paragraph': return { id, kind, text: 'Write your message here.' };
    // Empty URLs deliberately block export until the author supplies a real asset/destination.
    case 'image': return { id, kind, src: '', alt: '' };
    case 'button': return { id, kind, href: '', label: 'Learn more' };
    case 'divider': return { id, kind };
  }
}

export function moveBlock(document: CampaignDocument, id: string, offset: -1 | 1): CampaignDocument {
  const from = document.blocks.findIndex((block) => block.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= document.blocks.length) return document;
  const blocks = [...document.blocks];
  const source = blocks[from];
  const target = blocks[to];
  if (!source || !target) return document;
  blocks[from] = target;
  blocks[to] = source;
  return { ...document, blocks };
}

export function moveBefore(document: CampaignDocument, id: string, targetId: string): CampaignDocument {
  if (id === targetId) return document;
  const source = document.blocks.find((block) => block.id === id);
  if (!source || !document.blocks.some((block) => block.id === targetId)) return document;
  const blocks = document.blocks.filter((block) => block.id !== id);
  blocks.splice(blocks.findIndex((block) => block.id === targetId), 0, source);
  return { ...document, blocks };
}

export function draftReceipt(source: string, expectedOrigin: string) {
  const value = jsonObject(readJson(source));
  const id = text(value.id, 'Draft ID', 24);
  if (!/^[a-f0-9]{24}$/iu.test(id)) throw new CampaignInputError('The draft service returned an invalid receipt.');
  // Ignore the provider's URL, which must not choose the navigation destination.
  return { id, url: `${new URL(expectedOrigin).origin}/campaigns/${id}` };
}
