// Security pass H1, held as tests: the guardian leg of the fan-out delivers.
//
// Three claims. The mail goes to every active guardian and the record says so;
// a report already marked is left alone and nothing is sent; and what the
// sender is handed has no field through which the child's words could travel.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.3 · packages/app/features/safety/guardian-alert.service.ts
// SOT-KEYWORDS: guardian alert test fan out email in-app channel idempotent first name no transcript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IncidentReport } from '@acme/safety';
import {
  deliverGuardianAlert,
  incidentCategoryLabel,
  type GuardianAlertPorts,
  type SendGuardianIncidentEmail,
} from './guardian-alert.service.ts';

const NOW = new Date('2026-08-27T10:15:00.000Z');
const TRANSCRIPT_WORDS = 'I want to hurt myself';

const report = (over: Partial<IncidentReport> = {}): IncidentReport => ({
  incidentId: 'inc_1',
  source: 'automated',
  reporterRole: 'system',
  reporterId: null,
  anonymous: false,
  subjectLearnerId: 'ada_1',
  relatedSessionId: 'sess_1',
  relatedEventId: 'evt_1',
  category: 'self-harm',
  severity: 'S4',
  occurredAt: '2026-08-27T10:12:00.000Z',
  // Never real: the automated path writes a system sentence, and the test
  // puts words here only to prove they cannot reach the sender.
  summary: TRANSCRIPT_WORDS,
  transcriptExcerpt: { sessionId: 'sess_1', messageIds: ['msg_77'] },
  attachmentIds: [],
  immediateActionTaken: null,
  status: 'new',
  assigneeId: null,
  slaDueAt: '2026-08-27T12:12:00.000Z',
  guardianVisible: true,
  guardianNotifiedAt: null,
  reviewPagedAt: null,
  guardianAcknowledgedAt: null,
  resolution: null,
  timeline: [],
  expiresAt: '2026-09-26T10:12:00.000Z',
  legalHold: null,
  ...over,
});

function fakePorts(sendEmail: SendGuardianIncidentEmail | null) {
  const sent: Parameters<SendGuardianIncidentEmail>[0][] = [];
  const ports: GuardianAlertPorts = {
    loadGuardianContacts: async (learnerAuthId) => {
      assert.equal(learnerAuthId, 'ada_1', 'contacts must be read for the report’s subject');
      return [
        { userId: 'mum_1', email: 'mum@example.com' },
        { userId: 'dad_1', email: 'dad@example.com' },
        { userId: 'pending_1', email: null },
      ];
    },
    loadLearnerFirstName: async () => 'Ada Lovelace',
    sendEmail:
      sendEmail === null
        ? null
        : async (delivery) => {
            sent.push(delivery);
            return sendEmail(delivery);
          },
    alertsUrl: 'https://app.moyolearn.com/alerts',
  };
  return { ports, sent };
}

describe('security pass H1 — the guardian leg reaches a real channel', () => {
  it('mails every active guardian with an address and records both channels', async () => {
    const { ports, sent } = fakePorts(async (d) => (d.guardian.email ? 'sent' : 'skipped-no-address'));
    const out = await deliverGuardianAlert(report(), ports, NOW);

    assert.deepEqual(sent.map((d) => d.guardian.userId), ['mum_1', 'dad_1', 'pending_1']);
    assert.equal(out.guardianNotifiedAt, NOW.toISOString());
    const entry = out.timeline.at(-1);
    assert.equal(entry?.action, 'guardian-notified');
    assert.equal(entry?.note, 'in-app, email');
  });

  it('hands the sender the four facts and no words from the session', async () => {
    const { ports, sent } = fakePorts(async () => 'sent');
    await deliverGuardianAlert(report(), ports, NOW);
    const first = sent[0];
    assert.ok(first);
    assert.deepEqual(first.facts, {
      learnerFirstName: 'Ada',
      categoryLabel: incidentCategoryLabel('self-harm'),
      occurredAt: '2026-08-27T10:12:00.000Z',
      alertsUrl: 'https://app.moyolearn.com/alerts',
    });
    assert.equal(first.incidentId, 'inc_1');
    assert.ok(!JSON.stringify(sent).includes(TRANSCRIPT_WORDS), 'the summary line reached the sender');
    assert.ok(!JSON.stringify(sent).includes('Lovelace'), 'the surname reached the sender');
    assert.ok(!JSON.stringify(sent).includes('msg_77'), 'a message id reached the sender');
  });

  it('records in-app alone when no sender is configured, and still marks the report', async () => {
    const { ports } = fakePorts(null);
    const out = await deliverGuardianAlert(report(), ports, NOW);
    assert.equal(out.guardianNotifiedAt, NOW.toISOString());
    assert.equal(out.timeline.at(-1)?.note, 'in-app');
  });

  it('records in-app alone when every send was skipped', async () => {
    const { ports } = fakePorts(async () => 'skipped-placeholder');
    const out = await deliverGuardianAlert(report(), ports, NOW);
    assert.equal(out.timeline.at(-1)?.note, 'in-app');
  });

  it('is idempotent: an already-notified report is returned unchanged and nothing is sent', async () => {
    const { ports, sent } = fakePorts(async () => 'sent');
    const already = report({ guardianNotifiedAt: '2026-08-27T10:13:00.000Z' });
    const out = await deliverGuardianAlert(already, ports, NOW);
    assert.equal(out, already);
    assert.equal(sent.length, 0);
  });

  it('writes no marker when a send throws, so the job retries', async () => {
    const { ports } = fakePorts(async () => {
      throw new Error('Resend rejected the guardian incident email (HTTP 500): upstream');
    });
    await assert.rejects(() => deliverGuardianAlert(report(), ports, NOW), /Resend rejected/);
  });

  it('does not mail an S1 or S2 — those rungs do not notify a guardian', async () => {
    const { ports, sent } = fakePorts(async () => 'sent');
    const out = await deliverGuardianAlert(report({ severity: 'S1', category: 'profanity' }), ports, NOW);
    assert.equal(sent.length, 0);
    assert.equal(out.timeline.at(-1)?.note, 'in-app');
  });
});
