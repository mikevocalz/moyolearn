// One HTML document for an approved practice set, in two modes: the sheet a
// child works on, and the key an adult checks it with. The web print route
// serves it and expo-print renders it on device, so the two never drift.
//
// Pure string assembly with no DOM and no React, because expo-print takes a
// string and the route returns one. Every value that came from a row passes
// through `escapeHtml`, including the ones the generator wrote: the generator
// is ours today, and an escaping rule with exceptions is one nobody audits.
//
// The sheet carries no answers, no score box and no "correct / incorrect"
// column; it says in words that it is practice. The key says in words who it
// is for. Neither relies on colour: every distinction is a label or a rule,
// so a greyscale printer loses nothing.
// SOT: docs/work/pr-100/contract.md §Practice sets · apps/web/lib/printable-homework.ts · docs/design/homework-end-to-end-2026.md
// SOT-KEYWORDS: practice sheet answer key html print pagination escape adult guardian expo-print
import { PRACTICE_SKILL_LABELS, isPracticeSkillTag } from '@acme/student-model/pure';
import type { PracticeItem, PracticeSetView } from './homework.types.ts';

export type PracticeSheetMode = 'sheet' | 'key';

export const PRACTICE_SHEET_LABEL = 'Practice sheet (not a test)';
export const PRACTICE_KEY_LABEL = 'Answer key — for the adult';

export interface PracticeSheetOptions {
  /** A print button for the browser route. expo-print renders without one. */
  readonly toolbar?: boolean;
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const skillLabel = (tag: string): string => (isPracticeSkillTag(tag) ? PRACTICE_SKILL_LABELS[tag] : tag);

/* The checker's form uses an ASCII hyphen; the prompts print U+2212, so the key matches the sheet. */
const printedNumber = (answer: string): string => answer.replace(/^-/, '−');

function keyLine(item: PracticeItem): string {
  const value = printedNumber(item.answer);
  return item.prompt.startsWith('Solve for x') ? `x = ${value}` : value;
}

function skillsLine(set: PracticeSetView): string {
  const tags = set.targetedTags.length > 0 ? set.targetedTags : [...new Set(set.items.map((item) => item.skillTag))];
  return tags.map(skillLabel).join(', ');
}

const STYLE =
  '@page{size:letter;margin:.6in}' +
  '*{box-sizing:border-box}' +
  'body{font:15px/1.5 system-ui,-apple-system,Arial,sans-serif;color:#201e1b;background:#fff;margin:0 auto;max-width:760px;padding:24px}' +
  'h1{font-size:24px;line-height:1.2;margin:4px 0 8px}' +
  '.label{display:inline-block;border:2px solid #201e1b;padding:2px 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}' +
  '.meta{font-size:13px;color:#4a453d;margin:6px 0}' +
  '.fields{display:flex;gap:24px;margin:14px 0 18px;font-size:14px}' +
  '.fields span{flex:1;border-bottom:1px solid #201e1b;padding-bottom:2px}' +
  'ol{list-style:none;margin:0;padding:0}' +
  '.item{break-inside:avoid;page-break-inside:avoid;border-top:1px solid #8a8378;padding:14px 0}' +
  '.prompt{font-size:18px;margin:0 0 6px}' +
  '.num{font-weight:700;margin-right:8px}' +
  '.work{height:96px;border:1px dashed #8a8378;margin-top:6px}' +
  '.work small{display:block;font-size:11px;color:#4a453d;padding:4px 6px}' +
  '.answer{font-size:16px;margin:4px 0 0}' +
  '.answer strong{margin-right:6px}' +
  '.skill{font-size:12px;color:#4a453d}' +
  '.note{border:1px solid #8a8378;padding:10px 12px;margin-top:18px;font-size:13px;break-inside:avoid}' +
  '.toolbar{display:flex;justify-content:flex-end;margin:0 0 16px}' +
  'button{font:inherit;padding:10px 18px;border:2px solid #201e1b;border-radius:8px;background:#fff;cursor:pointer}' +
  '@media print{body{padding:0;max-width:none}.toolbar{display:none!important}}';

function sheetBody(set: PracticeSetView): string {
  const items = set.items
    .map(
      (item, index) =>
        '<li class="item"><p class="prompt"><span class="num">' +
        String(index + 1) +
        '.</span>' +
        escapeHtml(item.prompt) +
        '</p><div class="work"><small>Show your work</small></div></li>',
    )
    .join('');
  return (
    '<p class="label">' + escapeHtml(PRACTICE_SHEET_LABEL) + '</p>' +
    '<h1>Practice</h1>' +
    '<p class="meta">Skills: ' + escapeHtml(skillsLine(set)) + '</p>' +
    '<div class="fields"><span>Name</span><span>Date</span></div>' +
    '<ol>' + items + '</ol>' +
    '<p class="note">Try each one, and show how you worked it out. Leaving one blank is fine.</p>'
  );
}

function keyBody(set: PracticeSetView): string {
  const items = set.items
    .map(
      (item, index) =>
        '<li class="item"><p class="prompt"><span class="num">' +
        String(index + 1) +
        '.</span>' +
        escapeHtml(item.prompt) +
        '</p><p class="answer"><strong>Answer:</strong>' +
        escapeHtml(keyLine(item)) +
        '</p><p class="skill">' +
        escapeHtml(skillLabel(item.skillTag)) +
        '</p></li>',
    )
    .join('');
  return (
    '<p class="label">' + escapeHtml(PRACTICE_KEY_LABEL) + '</p>' +
    '<h1>Answers</h1>' +
    '<p class="meta">Skills: ' + escapeHtml(skillsLine(set)) + '</p>' +
    '<ol>' + items + '</ol>' +
    '<p class="note">Each answer was checked by exact arithmetic before this key was made. ' +
    'Use it to talk through the work, not to score it. An equivalent form, such as 2/4 for 1/2, is also right.</p>' +
    '<p class="meta">Checked by ' + escapeHtml(set.items[0]?.checkerVersion ?? 'exact-math') + '</p>'
  );
}

export function practiceSheetHtml(
  set: PracticeSetView,
  mode: PracticeSheetMode,
  options: PracticeSheetOptions = {},
): string {
  const title = mode === 'sheet' ? PRACTICE_SHEET_LABEL : PRACTICE_KEY_LABEL;
  const empty = '<p class="note">This set has no items to print.</p>';
  const body = set.items.length === 0 ? empty : mode === 'sheet' ? sheetBody(set) : keyBody(set);
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + escapeHtml(title) + ' | Moyo Learn</title>' +
    '<style>' + STYLE + '</style></head><body>' +
    (options.toolbar
      ? '<div class="toolbar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>'
      : '') +
    body +
    '</body></html>'
  );
}
