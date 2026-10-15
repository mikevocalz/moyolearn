// Print-only, evidence-derived family handouts. No LLM-generated questions,
// no invented outcomes, and no exposure of raw tutor transcripts.
// The browser's native print dialog can print or Save as PDF.
import type { GuardianSummaryView } from '@acme/app/server';

export type PrintableMode = 'report' | 'practice';
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function questionText(row: GuardianSummaryView['problems'][number]['rows'][number]): string {
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
  const shown = practice ? review : rows;
  const subjectLabels = report.workedOn.map((item) => item.parentLabel).slice(0, 3);
  const problemMarkup = shown.length
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
    'button{padding:10px 18px;border:1px solid #777;border-radius:8px;background:#fff;cursor:pointer}' +
    '@media print{body{padding:0;max-width:none}.toolbar{display:none!important}}' +
    '</style></head><body>' +
    '<div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>' +
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
