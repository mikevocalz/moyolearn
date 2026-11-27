// The incident mail's sender, composed once from the same two variables Better
// Auth's verification and reset mails read (`RESEND_API_KEY`,
// `AUTH_EMAIL_FROM`). One sender, one `from`, one redaction rule.
//
// `null` when they are unset. The service then records the guardian leg as
// `in-app` alone, which is the truth; the loud line below is so the gap reads
// like the operations problem it is rather than a quiet downgrade — the same
// posture `createAuth` takes when the verification sender is missing.
// SOT: packages/auth/src/auth-email.ts · packages/app/features/safety/guardian-alert.service.ts
// SOT-KEYWORDS: guardian alert email sender resend incident composition root
import 'server-only';
import { readAuthEmailConfig, sendIncidentEmailFor } from '@acme/auth/server';
import type { SendGuardianIncidentEmail } from '@acme/app/server';

let warned = false;

export function guardianIncidentEmailSender(): SendGuardianIncidentEmail | null {
  const emailConfig = readAuthEmailConfig();
  if (emailConfig === null) {
    if (!warned) {
      warned = true;
      console.error(
        '[safety] RESEND_API_KEY / AUTH_EMAIL_FROM are not set, so guardian incident emails cannot be sent. ' +
          'S3 and S4 incidents will reach guardians in-app only until both variables are set.',
      );
    }
    return null;
  }
  return (delivery) =>
    sendIncidentEmailFor(emailConfig, {
      guardian: { id: delivery.guardian.userId, email: delivery.guardian.email },
      incidentId: delivery.incidentId,
      facts: delivery.facts,
    });
}
