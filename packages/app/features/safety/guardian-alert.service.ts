import 'server-only';
// Doc 31 §4.3's guardian leg, delivered: "S3 → guardian in-app + email; S4 →
// guardian immediately."
//
// The fan-out job used to write the `guardian-notified` marker with the channel
// `in-app` and stop, so an S3 reached a parent only if they happened to open the
// app (security pass H1). This is the service that makes the second channel
// real. It decides WHO is mailed (every ACTIVE guardian of the child, by the
// same guardianship rows every other guardian surface trusts), WHAT the mail
// may say (`IncidentEmailFacts`, a closed list with no field for a transcript),
// and WHAT THE RECORD SAYS AFTERWARDS (the channels that actually ran).
//
// IT RUNS INSIDE A JOB, so there is no session to take identity from and no
// `protectedOperation` here — the `generateSessionSummary` precedent. Identity
// is the report's `subjectLearnerId`, read off the row the job loaded.
//
// ORDER IS THE GUARANTEE. The mail goes first and the marker is written after,
// so a send that throws leaves `guardianNotifiedAt` null and the job retries;
// the sender's idempotency key over (guardian, incident) turns that retry into
// the same request at Resend rather than a second alert. A marker written first
// would make a dead sender look like a delivered one.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.3 · packages/auth/src/auth-email.ts · docs/verification/security-pass-2026-11.md H1
// SOT-KEYWORDS: guardian alert service incident fan out email deliver channel in-app marker idempotent first name category label
import type { IncidentEmailFacts, SendOutcome } from '@acme/auth/server';
import { markFannedOut, tierAtLeast, type IncidentCategory, type IncidentReport } from '@acme/safety';

/** One guardian's Better Auth row, as much of it as a mail needs. */
export interface GuardianContact {
  readonly userId: string;
  readonly email: string | null;
}

/** Every ACTIVE guardian of a learner. `invited` and `revoked` rows are not family. */
export type LoadGuardianContacts = (learnerAuthId: string) => Promise<readonly GuardianContact[]>;

/** The learner's display name, or null when the row is gone. The service keeps the first word. */
export type LoadLearnerFirstName = (learnerAuthId: string) => Promise<string | null>;

/**
 * The composed sender. `null` when no sender is configured — the composition
 * root decides that from `readAuthEmailConfig`, and the service records the
 * channel honestly as `in-app` alone rather than pretending.
 */
export type SendGuardianIncidentEmail = (delivery: {
  readonly guardian: GuardianContact;
  readonly incidentId: string;
  readonly facts: IncidentEmailFacts;
}) => Promise<SendOutcome>;

export interface GuardianAlertPorts {
  readonly loadGuardianContacts: LoadGuardianContacts;
  readonly loadLearnerFirstName: LoadLearnerFirstName;
  readonly sendEmail: SendGuardianIncidentEmail | null;
  /** The guardian alerts screen, absolute. */
  readonly alertsUrl: string;
}

/**
 * Parent-facing words for an incident category. The enum keys are a reviewer's
 * vocabulary (`abuse-disclosure`, `pii-shared`); a mail to a parent names the
 * kind of thing without a taxonomy. Nothing here quotes the session.
 */
const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  profanity: 'language that is not for a tutoring session',
  'sexual-content': 'content that is not appropriate for a child',
  bullying: 'a concern about bullying',
  'pii-shared': 'personal information shared in the session',
  violence: 'a concern about violence',
  substances: 'a concern about drugs or alcohol',
  'self-harm': 'a safety concern that needs your attention now',
  'abuse-disclosure': 'a safety concern that needs your attention now',
  'tutor-behavior': 'a concern about how the tutor responded',
  'safety-concern': 'a safety concern',
  other: 'a safety alert',
};

export const incidentCategoryLabel = (category: IncidentCategory): string =>
  CATEGORY_LABEL[category];

/** The first word of a display name, or an empty string the composer replaces. */
const firstNameOf = (name: string | null): string => (name ?? '').trim().split(/\s+/)[0] ?? '';

/**
 * Delivers one incident to its guardians and returns the report with the
 * `guardian-notified` marker set to the channels that ran. Idempotent: a report
 * already marked comes back unchanged and nothing is sent.
 *
 * Only S3 and up are mailed — the ladder's `notifiesGuardian` rungs — and only
 * when the report is guardian-visible, which `fanOut` has already checked
 * before enqueueing; both are re-checked here because a queue row is a claim.
 */
export async function deliverGuardianAlert(
  report: IncidentReport,
  ports: GuardianAlertPorts,
  now: Date = new Date(),
): Promise<IncidentReport> {
  if (report.guardianNotifiedAt !== null) return report;

  const channels: string[] = ['in-app'];

  if (ports.sendEmail !== null && report.guardianVisible && tierAtLeast(report.severity, 'S3')) {
    const [contacts, name] = await Promise.all([
      ports.loadGuardianContacts(report.subjectLearnerId),
      ports.loadLearnerFirstName(report.subjectLearnerId),
    ]);
    const facts: IncidentEmailFacts = {
      learnerFirstName: firstNameOf(name),
      categoryLabel: incidentCategoryLabel(report.category),
      occurredAt: report.occurredAt,
      alertsUrl: ports.alertsUrl,
    };

    let sent = 0;
    for (const guardian of contacts) {
      const outcome = await ports.sendEmail({ guardian, incidentId: report.incidentId, facts });
      if (outcome === 'sent') sent += 1;
    }
    if (sent > 0) channels.push('email');
  }

  return markFannedOut(report, 'guardian', channels.join(', '), now);
}
