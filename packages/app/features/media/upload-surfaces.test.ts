// The pure half of doc 30's three upload surfaces: validation verdicts, the
// count-accurate primary button, and the transfer-row state machine the tray
// renders. Written before the implementation — these are the behaviours the
// demos die without (doc 30 §5), so they are pinned first.
// SOT: docs/pack/30-upload-surfaces-spec.md §3–§5 · docs/pack/29-bunny-media-spec.md §4
// SOT-KEYWORDS: upload surfaces test validation verdict transfer tray reducer tabs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptForKinds,
  applyTransfer,
  kindForMime,
  primaryAction,
  rowsForTab,
  trayTitle,
  validateCandidates,
  verdictSummary,
  zoneRules,
  type CandidateFile,
  type TransferRow,
} from './upload-surfaces.shared.ts';

const file = (over: Partial<CandidateFile> = {}): CandidateFile => ({
  uri: 'blob:a',
  name: 'worksheet.pdf',
  type: 'application/pdf',
  size: 1024,
  ...over,
});

describe('kindForMime', () => {
  it('routes images, audio, and documents to their kinds', () => {
    assert.equal(kindForMime('image/png'), 'image');
    assert.equal(kindForMime('audio/m4a'), 'audio');
    assert.equal(kindForMime('application/pdf'), 'document');
  });

  it('treats an mp4 container as audio — a recorder writing .mp4 is a voice note', () => {
    assert.equal(kindForMime('video/mp4'), 'audio');
  });
});

describe('validation happens on drop, per file (doc 30 §3)', () => {
  it('accepts a valid file and names its kind', () => {
    const [verdict] = validateCandidates([file()]);
    assert.ok(verdict);
    assert.equal(verdict.ok, true);
    if (verdict.ok) assert.equal(verdict.kind, 'document');
  });

  it('rejects an unsupported type with a sentence, not a code', () => {
    const [verdict] = validateCandidates([
      file({ name: 'setup.exe', type: 'application/x-msdownload' }),
    ]);
    assert.ok(verdict);
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.match(verdict.reason, /can.t be uploaded/i);
  });

  it('rejects an oversize file naming the limit in MB', () => {
    const [verdict] = validateCandidates([file({ size: 26 * 1024 * 1024 })]);
    assert.ok(verdict);
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.match(verdict.reason, /25 MB/);
  });

  it('rejects an empty file', () => {
    const [verdict] = validateCandidates([file({ size: 0 })]);
    assert.ok(verdict);
    assert.equal(verdict.ok, false);
  });

  it('one bad file does not poison the batch — each row gets its own verdict', () => {
    const verdicts = validateCandidates([
      file({ name: 'ok.pdf' }),
      file({ name: 'bad.exe', type: 'application/x-msdownload' }),
      file({ name: 'photo.png', type: 'image/png' }),
    ]);
    assert.deepEqual(
      verdicts.map((v) => v.ok),
      [true, false, true],
    );
  });
});

describe('the primary button counts reality (doc 30 §3)', () => {
  const good = file();
  const bad = file({ type: 'application/x-msdownload' });

  it('is disabled at zero rather than enabled and doomed', () => {
    const action = primaryAction(validateCandidates([bad]));
    assert.equal(action.label, 'Upload 0 files');
    assert.equal(action.enabled, false);
  });

  it('speaks singular for one file', () => {
    const action = primaryAction(validateCandidates([good]));
    assert.equal(action.label, 'Upload 1 file');
    assert.equal(action.enabled, true);
  });

  it('counts only the valid files in a mixed batch', () => {
    const action = primaryAction(validateCandidates([good, bad, good]));
    assert.equal(action.label, 'Upload 2 files');
    assert.equal(action.enabled, true);
    assert.equal(action.count, 2);
  });
});

describe('the footer summary', () => {
  it('is silent when everything is valid', () => {
    assert.equal(verdictSummary(validateCandidates([file()])), null);
  });

  it('counts the invalid rows', () => {
    const summary = verdictSummary(
      validateCandidates([
        file({ type: 'application/x-msdownload' }),
        file({ type: 'application/x-msdownload' }),
        file(),
      ]),
    );
    assert.equal(summary, '2 invalid files');
  });

  it('speaks singular for one', () => {
    const summary = verdictSummary(validateCandidates([file({ type: 'text/calendar' })]));
    assert.equal(summary, '1 invalid file');
  });
});

const queuedEvent = (id: string) =>
  ({ type: 'queued', id, name: `${id}.pdf`, mimeType: 'application/pdf', bytesTotal: 100 }) as const;

const seed = (...ids: string[]): TransferRow[] =>
  ids.reduce<TransferRow[]>((rows, id) => applyTransfer(rows, queuedEvent(id)), []);

describe('the transfer-row state machine (doc 29 §4 two-phase)', () => {
  it('a queued row starts queued', () => {
    const rows = seed('a');
    assert.equal(rows[0]?.status, 'queued');
  });

  it('queueing the same id twice keeps one row', () => {
    const rows = applyTransfer(seed('a'), queuedEvent('a'));
    assert.equal(rows.length, 1);
  });

  it('begin moves it to uploading', () => {
    const rows = applyTransfer(seed('a'), { type: 'begin', id: 'a' });
    assert.equal(rows[0]?.status, 'uploading');
  });

  it('bytes at 100% is NOT done — that is the bug everyone ships', () => {
    let rows = applyTransfer(seed('a'), { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'progress', id: 'a', bytesSent: 100, bytesTotal: 100 });
    assert.equal(rows[0]?.status, 'uploading');
    assert.equal(rows[0]?.bytesSent, 100);
  });

  it('processing is its own phase between bytes-done and ready', () => {
    let rows = applyTransfer(seed('a'), { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'progress', id: 'a', bytesSent: 100, bytesTotal: 100 });
    rows = applyTransfer(rows, { type: 'processing', id: 'a' });
    assert.equal(rows[0]?.status, 'processing');
    rows = applyTransfer(rows, { type: 'done', id: 'a' });
    assert.equal(rows[0]?.status, 'done');
  });

  it('failure keeps the bytes already sent — retry resumes, not restarts', () => {
    let rows = applyTransfer(seed('a'), { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'progress', id: 'a', bytesSent: 60, bytesTotal: 100 });
    rows = applyTransfer(rows, { type: 'failed', id: 'a', error: 'Network dropped.' });
    assert.equal(rows[0]?.status, 'failed');
    assert.equal(rows[0]?.bytesSent, 60);
    assert.equal(rows[0]?.error, 'Network dropped.');

    rows = applyTransfer(rows, { type: 'retried', id: 'a' });
    assert.equal(rows[0]?.status, 'queued');
    assert.equal(rows[0]?.bytesSent, 60);
    assert.equal(rows[0]?.error, null);
  });

  it('a late progress event cannot demote a finished row', () => {
    let rows = applyTransfer(seed('a'), { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'done', id: 'a' });
    rows = applyTransfer(rows, { type: 'progress', id: 'a', bytesSent: 10, bytesTotal: 100 });
    assert.equal(rows[0]?.status, 'done');
  });

  it('events for an unknown id are no-ops — a background drain may finish after a clear', () => {
    const rows = applyTransfer([], { type: 'done', id: 'ghost' });
    assert.equal(rows.length, 0);
  });

  it('cleared removes only the done rows', () => {
    let rows = seed('a', 'b');
    rows = applyTransfer(rows, { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'done', id: 'a' });
    rows = applyTransfer(rows, { type: 'cleared' });
    assert.deepEqual(
      rows.map((r) => r.id),
      ['b'],
    );
  });
});

describe('tray tabs (doc 30 §1 — All / Active / Completed / Failed)', () => {
  const rows = (() => {
    let r = seed('queued', 'uploading', 'processing', 'done', 'failed');
    r = applyTransfer(r, { type: 'begin', id: 'uploading' });
    r = applyTransfer(r, { type: 'begin', id: 'processing' });
    r = applyTransfer(r, { type: 'processing', id: 'processing' });
    r = applyTransfer(r, { type: 'begin', id: 'done' });
    r = applyTransfer(r, { type: 'done', id: 'done' });
    r = applyTransfer(r, { type: 'begin', id: 'failed' });
    r = applyTransfer(r, { type: 'failed', id: 'failed', error: 'x' });
    return r;
  })();

  it('active is queued + uploading + processing', () => {
    assert.deepEqual(
      rowsForTab(rows, 'active').map((r) => r.id),
      ['queued', 'uploading', 'processing'],
    );
  });

  it('completed and failed are exactly their statuses, and all is everything', () => {
    assert.deepEqual(rowsForTab(rows, 'completed').map((r) => r.id), ['done']);
    assert.deepEqual(rowsForTab(rows, 'failed').map((r) => r.id), ['failed']);
    assert.equal(rowsForTab(rows, 'all').length, 5);
  });
});

describe('the tray title says what is happening (doc 30 §1 — Proton pattern)', () => {
  it('is null with nothing to show — no tray at all', () => {
    assert.equal(trayTitle([]), null);
  });

  it('aggregates active transfers into one honest figure', () => {
    let rows = seed('a', 'b');
    rows = applyTransfer(rows, { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'progress', id: 'a', bytesSent: 50, bytesTotal: 100 });
    assert.equal(trayTitle(rows), '2 uploading (25%)');
  });

  it('names failure once everything active has drained', () => {
    let rows = seed('a');
    rows = applyTransfer(rows, { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'failed', id: 'a', error: 'x' });
    assert.equal(trayTitle(rows), '1 failed');
  });

  it('says done when everything landed', () => {
    let rows = seed('a');
    rows = applyTransfer(rows, { type: 'begin', id: 'a' });
    rows = applyTransfer(rows, { type: 'done', id: 'a' });
    assert.equal(trayTitle(rows), 'Done');
  });
});

describe('the rules printed inside the zone (doc 30 §2)', () => {
  it('states every kind with its ceiling, before the user tests it by failure', () => {
    assert.equal(zoneRules(['image', 'document']), 'Images up to 20 MB · Documents up to 25 MB');
  });

  it('ceilings come from MAX_BYTES, so the zone and the server cannot disagree', () => {
    assert.equal(zoneRules(['audio']), 'Audio up to 50 MB');
  });
});

describe('acceptForKinds — the picker filter, never the rule', () => {
  it('joins the per-kind accept lists for the real file input', () => {
    assert.equal(acceptForKinds(['image', 'audio']), 'image/*,audio/*,video/mp4');
  });
});

describe('formatBytes — the mono column the eye can compare', () => {
  it('picks the unit and keeps one decimal below 10', async () => {
    const { formatBytes } = await import('./upload-surfaces.shared.ts');
    assert.equal(formatBytes(0), '0 KB');
    assert.equal(formatBytes(512), '1 KB');
    assert.equal(formatBytes(1536), '2 KB');
    assert.equal(formatBytes(3.4 * 1024 * 1024), '3.4 MB');
    assert.equal(formatBytes(24 * 1024 * 1024), '24 MB');
  });
});
