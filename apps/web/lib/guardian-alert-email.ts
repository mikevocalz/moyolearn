// The incident mail's sender, composed once from the same two variables Better
// Auth's verification and reset mails read (`RESEND_API_KEY`,
// `AUTH_EMAIL_FROM`). One sender, one `from`, one redaction rule.
//
// `null` when they are unset. The service then records the guardian leg as
// `in-app` alone, which is the truth; the loud line below is so the gap reads
// like the operations problem it is rather than a quiet downgrade — the same
// posture `createAuth` takes when the verification sender is missing.
// SOT: packages/auth/src/auth-email.ts · packages/app/features/safety/guardian-alert.service.ts
//
// The mail's ONE link is composed here too, from `NEXT_PUBLIC_APP_URL` — the
// learning app's public origin (docs/deploy/moyo-vercel-deployment.md §6), not
// `NEXT_PUBLIC_SITE_URL`, which is set on the admin project alone. The job
// runner's sweep origin falls back to localhost because nobody follows it; a
// parent follows this one, so outside a development build an unset or
// non-https origin THROWS and the job dead-letters loudly instead of mailing a
// guardian `http://localhost:3000/alerts`.
// SOT-KEYWORDS: guardian alert email sender resend incident composition root alerts url app origin NEXT_PUBLIC_APP_URL
import 'server-only';
import { readAuthEmailConfig, sendIncidentEmailFor } from '@acme/auth/server';
import type { SendGuardianIncidentEmail } from '@acme/app/server';

type Env = Readonly<Record<string, string | undefined>>;

/** The guardian alerts screen, absolute, on the learning app's public origin. */
export function guardianAlertsUrl(env: Env = process.env): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  const development = env.NODE_ENV === 'development';
  if (configured === '') {
    if (development) return new URL('/alerts', 'http://localhost:3000').toString();
    throw new Error('NEXT_PUBLIC_APP_URL is not set — guardian alert links have no public origin.');
  }
  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new Error('NEXT_PUBLIC_APP_URL is not an absolute URL — guardian alert links cannot be built.');
  }
  if (origin.protocol !== 'https:' && !(development && origin.protocol === 'http:')) {
    throw new Error('NEXT_PUBLIC_APP_URL must be https — guardian alert links go to parents.');
  }
  return new URL('/alerts', origin.origin).toString();
}

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
