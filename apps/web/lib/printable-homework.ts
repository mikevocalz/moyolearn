// Print-only, evidence-derived family handouts. No LLM-generated questions,
// no invented outcomes, and no exposure of raw tutor transcripts.
// The browser's native print dialog can print or Save as PDF.
//
// Worksheet rows print as a table: order, source number, outcome in words,
// attempts, hints. Meaning never rides on colour, so a grayscale printer and
// a screen reader get the same facts. Outcome words avoid "correct" and
// "solved" because a photographed page is never graded (ADR-119).
// SOT: docs/work/pr-100/contract.md §Report · docs/pack/34-session-summary-reports.md §2.3
// SOT-KEYWORDS: printable report worksheet outcome table print css page break grayscale escape
import type { GuardianSummaryView } from '@acme/app/server';

type PrintableRow = GuardianSummaryView['problems'][number]['rows'][number];
type HomeworkDetail = NonNullable<PrintableRow['homework']>;

export type PrintableMode = 'report' | 'practice';
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function questionText(row: PrintableRow): string {
  return row.question.kind === 'expired'
    ? 'Source no longer available'
    : row.question.kind === 'crop'
      ? row.question.text ?? 'Image only (see the secure online report)'
      : row.question.text;
}

const statusLabel: Record<string, string> = {
  'solved-independently': 'Solved independently',
  'solved-with-help': 'Solved with help',
  'still-working': 'Still working',
};

const outcomeLabel: Record<HomeworkDetail['outcome'], string> = {
  'solved-independently': 'Finished without hints',
  'supported-with-hints': 'Finished with hints',
  attempted: 'Attempted, still open',
  unresolved: 'Still working',
  skipped: 'Skipped',
  unattempted: 'Not started',
};

const plural = (n: number, one: string, many: string): string => String(n) + ' ' + (n === 1 ? one : many);

function worksheetTable(rows: readonly { row: PrintableRow; detail: HomeworkDetail }[]): string {
  const sorted = [...rows].sort((a, b) => a.detail.orderIndex - b.detail.orderIndex);
  return '<table class="worksheet"><caption>Worksheet questions in the order they were worked</caption>' +
    '<thead><tr><th scope="col">Order</th><th scope="col">Source</th><th scope="col">Question</th>' +
    '<th scope="col">Outcome</th><th scope="col">Attempts</th><th scope="col">Hints</th></tr></thead><tbody>' +
    sorted.map(({ row, detail }) =>
      '<tr><th scope="row">' + String(detail.orderIndex + 1) + '</th>' +
      '<td>' + (detail.sourceNumber === null
        ? 'Page ' + String(detail.sourcePage) + ', unnumbered'
        : 'Page ' + String(detail.sourcePage) + ', no. ' + String(detail.sourceNumber)) + '</td>' +
      '<td class="question-text">' + escapeHtml(questionText(row)) + '</td>' +
      '<td>' + escapeHtml(outcomeLabel[detail.outcome]) + '</td>' +
      '<td>' + plural(row.attempts, 'attempt', 'attempts') + '</td>' +
      '<td>' + plural(detail.hintsUsed, 'hint', 'hints') + '</td></tr>',
    ).join('') +
    '</tbody></table>';
}

export function printReportHtml(report: GuardianSummaryView, mode: PrintableMode): string {
  const date = report.publishedAt && !Number.isNaN(Date.parse(report.publishedAt))
    ? new Date(report.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Session date unavailable';
  const practice = mode === 'practice';
  const rows = report.problems.flatMap((group) =>
    group.rows.map((row) => ({ subject: group.subject, row })),
  );
  const review = rows.filter(({ row }) =>
    row.status === 'still-working' || row.status === 'solved-with-help',
  );
  const worksheetRows = practice
    ? []
    : rows.flatMap(({ row }) => (row.homework ? [{ row, detail: row.homework }] : []));
  const shown = practice ? review : rows.filter(({ row }) => !row.homework);
  const subjectLabels = report.workedOn.map((item) => item.parentLabel).slice(0, 3);
  const articleMarkup = shown.length
    ? shown.map(({ subject, row }, i) =>
      '<article class="question">' +
      '<div class="question-head"><span>' + (i + 1) + '. ' + escapeHtml(subject) + '</span>' +
      (practice ? '' : '<small>' + escapeHtml(statusLabel[row.status] ?? 'Work in progress') + '</small>') +
      '</div>' +
      '<div class="question-text">' + escapeHtml(questionText(row)) + '</div>' +
      (practice
        ? '<div class="answer-lines">Show your steps here:<div class="line"></div><div class="line"></div><div class="line"></div></div>'
        : '<p class="student-answer">Student response: ' +
          escapeHtml(row.childAnswer ?? 'Not recorded') + '</p>') +
      '</article>',
    ).join('')
    : '';
  const problemMarkup = worksheetRows.length || articleMarkup
    ? (worksheetRows.length ? worksheetTable(worksheetRows) : '') + articleMarkup
    : '<p>No suitable questions are available for this printable sheet.</p>';

  const heading = practice ? 'Follow-up practice worksheet' : 'Tutoring session report';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + escapeHtml(heading) + ' | Moyo Learn</title>' +
    '<style>' +
    '@page{size:letter;margin:.7in}*{box-sizing:border-box}body{font:14px/1.5 system-ui,Arial,sans-serif;color:#201e1b;margin:0 auto;max-width:760px;padding:24px}' +
    'h1{font-size:26px;line-height:1.2;margin:0 0 12px}h2{font-size:17px;margin:25px 0 8px}p{margin:9px 0}' +
    '.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#625b50}' +
    '.meta{color:#625b50;font-size:12px}.intro{margin:18px 0 22px}.question{break-inside:avoid;border-top:1px solid #ddd5c9;padding:16px 0}' +
    '.question-head{display:flex;justify-content:space-between;font-weight:700}.question-head small{font-size:11px;font-weight:400}' +
    '.question-text{font-size:17px;white-space:pre-wrap;margin:12px 0}.answer-lines{font-size:12px;color:#625b50}' +
    '.line{height:38px;border-bottom:1px solid #bbb}.student-answer{background:#f6f3ee;padding:10px}' +
    '.note{background:#f7f3eb;padding:12px;margin-top:20px}.toolbar{display:flex;justify-content:flex-end;gap:8px;margin:8px 0 25px}' +
    '.toolbar{align-items:center;justify-content:space-between}.toolbar p{margin:0;color:#4a443b}' +
    'button{min-height:44px;padding:10px 18px;border:1px solid #5c564c;border-radius:8px;background:#fff;color:#201e1b;font:inherit;cursor:pointer}' +
    'button:focus-visible{outline:3px solid #201e1b;outline-offset:2px}' +
    'table.worksheet{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}' +
    'table.worksheet caption{text-align:left;font-size:12px;color:#4a443b;margin-bottom:6px}' +
    'table.worksheet th,table.worksheet td{border:1px solid #8a8378;padding:6px 8px;text-align:left;vertical-align:top}' +
    'table.worksheet thead th{background:#fff;border-bottom:2px solid #201e1b}' +
    'table.worksheet td.question-text{font-size:14px;margin:0}' +
    '@media print{body{padding:0;max-width:none;font-size:12pt}.toolbar{display:none!important}' +
    'h1,h2{break-after:avoid;page-break-after:avoid}' +
    'table.worksheet thead{display:table-header-group}' +
    'table.worksheet tr,.question,.note{break-inside:avoid;page-break-inside:avoid}' +
    'p{orphans:3;widows:3}}' +
    '</style></head><body>' +
    '<header class="toolbar"><p>Print or save as PDF from your browser</p>' +
    '<button type="button" onclick="window.print()">Print / Save as PDF</button></header>' +
    '<p class="eyebrow">Moyo Learn · Family learning record</p><h1>' + escapeHtml(heading) + '</h1>' +
    '<p class="meta">' + escapeHtml(date) + (subjectLabels.length ? ' · ' + escapeHtml(subjectLabels.join(', ')) : '') + '</p>' +
    (practice
      ? '<p class="intro">For another try at the areas that needed help. These are review questions from the actual session, not a new graded exam. Name: ________________________</p>'
      : '<p class="intro">' + escapeHtml(report.headline) + '</p>' +
        '<h2>What we worked on</h2>' +
        (report.workedOn.length ? report.workedOn.map((s) =>
          '<p><strong>' + escapeHtml(s.parentLabel) + ':</strong> ' + escapeHtml(s.whyItMatters) + '</p>',
        ).join('') : '<p>No skill observations recorded.</p>') +
        '<h2>What to do next</h2><p>' + escapeHtml(report.nextUp) + '</p>') +
    '<h2>' + (practice ? 'Practice these again' : 'Question-by-question record') + '</h2>' +
    problemMarkup +
    (practice
      ? '<p class="note">A parent can use this sheet to observe strategies. Do not treat an AI-transcribed question as graded unless the original was verified.</p>'
      : '<h2>Help at home</h2><p>' + escapeHtml(report.homeSupport.activity) + '</p>') +
    '<p class="meta">Only evidence from the selected, authorized tutoring report is included.</p>' +
    '</body></html>';
}
