import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuardianSummaryView } from '@acme/app/server';
import { printReportHtml } from './printable-homework.ts';

const report = {
  headline: 'Fractions and word problems',
  workedOn: [{ parentLabel: 'Fractions', whyItMatters: 'Compare parts of a whole' }],
  publishedAt: '2026-10-15T17:00:00.000Z',
  problems: [
    {
      subject: 'Math',
      rows: [
        { status: 'solved-with-help', question: { kind: 'text', text: '1. 1/2 + 1/4' }, childAnswer: '3/4' },
        { status: 'solved-independently', question: { kind: 'text', text: '2. 3+3' }, childAnswer: '6' },
        { status: 'still-working', question: { kind: 'text', text: '<script>alert(1)</script> 3. 4/5 - 1/2' }, childAnswer: null },
      ],
    },
  ],
  nextUp: 'Practice denominators',
  homeSupport: { activity: 'Use four paper squares.' },
} as unknown as GuardianSummaryView;

test('printable report shows true recorded outcomes, no script injection', () => {
  const html = printReportHtml(report, 'report');
  assert.match(html, /Fractions and word problems/);
  assert.match(html, /Solved independently/);
  assert.match(html, /Student response: 6/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});

test('follow-up worksheet only contains questions that needed help', () => {
  const html = printReportHtml(report, 'practice');
  assert.match(html, /1\/2 \+ 1\/4/);
  assert.match(html, /4\/5 - 1\/2/);
  assert.doesNotMatch(html, /3\+3/);
  assert.doesNotMatch(html, /Student response/);
  assert.match(html, /not a new graded exam/);
  assert.match(html, /Show your steps here/);
});

const worksheetReport = {
  ...report,
  problems: [
    {
      subject: 'Math',
      rows: [
        {
          status: 'still-working',
          question: { kind: 'text', text: '<script>alert("rev")</script> 7 x 8' },
          childAnswer: null,
          attempts: 3,
          homework: { orderIndex: 1, sourcePage: 1, sourceNumber: 4, outcome: 'attempted', hintsUsed: 2 },
        },
        {
          status: 'solved-independently',
          question: { kind: 'text', text: '6 x 7' },
          childAnswer: null,
          attempts: 1,
          homework: { orderIndex: 0, sourcePage: 1, sourceNumber: null, outcome: 'solved-independently', hintsUsed: 0 },
        },
      ],
    },
  ],
} as unknown as GuardianSummaryView;

test('worksheet rows print order, source number, outcome words, attempts and hints, escaped', () => {
  const html = printReportHtml(worksheetReport, 'report');
  assert.doesNotMatch(html, /<script>alert\("rev"\)/);
  assert.match(html, /&lt;script&gt;alert\(&quot;rev&quot;\)&lt;\/script&gt; 7 x 8/);
  assert.match(html, /Print or save as PDF from your browser/);
  assert.match(html, /<th scope="row">1<\/th><td>Page 1, unnumbered<\/td><td class="question-text">6 x 7<\/td><td>Finished without hints<\/td><td>1 attempt<\/td><td>0 hints<\/td>/);
  assert.match(html, /<th scope="row">2<\/th><td>Page 1, no\. 4<\/td>.*<td>Attempted, still open<\/td><td>3 attempts<\/td><td>2 hints<\/td>/);
  assert.doesNotMatch(html, /Student response/, 'a worksheet row has no recorded answer to print');
  assert.match(html, /page-break-inside:avoid/);
  assert.match(html, /thead\{display:table-header-group\}/);
});
