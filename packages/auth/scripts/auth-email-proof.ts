// Proof that the sender is wired the way the 2026-09-22 postmortem says it is.
//
// No RESEND_API_KEY / AUTH_EMAIL_FROM: renders the verification mail and the
// exact request headers to stdout and sends nothing. Both set: sends one real
// message to the address given as the only argument.
//   pnpm --filter @acme/auth email:proof                      # dry run
//   RESEND_API_KEY=… AUTH_EMAIL_FROM=… pnpm --filter @acme/auth email:proof you@example.com
// SOT: docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email proof script resend verification dry-run

import {
  idempotencyKeyFor,
  readAuthEmailConfig,
  sendAuthEmail,
  verificationEmail,
} from '../src/auth-email.ts';

// A throwaway token, deliberately not JWT-shaped: this file is scanned too.
const PROOF_TOKEN = `proof.${Date.now()}.local`;
const PROOF_URL = `https://moyolearn.com/api/auth/verify-email?token=${PROOF_TOKEN}&callbackURL=%2Ftutor`;

const to = process.argv[2];
const config = readAuthEmailConfig();
const message = verificationEmail(to ?? 'parent@example.com', PROOF_URL);
const idempotencyKey = idempotencyKeyFor('verify', 'proof-user', PROOF_TOKEN);

if (!config) {
  process.stdout.write(
    [
      'DRY RUN — RESEND_API_KEY / AUTH_EMAIL_FROM not set, nothing will be sent.',
      '',
      'POST https://api.resend.com/emails',
      'Authorization: Bearer <RESEND_API_KEY>',
      'Content-Type: application/json',
      `Idempotency-Key: ${idempotencyKey}`,
      '',
      `From: <AUTH_EMAIL_FROM>`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      '',
      '--- text ---',
      message.text,
      '',
      '--- html ---',
      message.html,
      '',
    ].join('\n'),
  );
  process.exit(0);
}

if (!to) {
  process.stderr.write('Sender is configured; pass the recipient address as the only argument.\n');
  process.exit(2);
}

await sendAuthEmail(config, message, { purpose: 'verify', idempotencyKey });
process.stdout.write(`Sent "${message.subject}" to ${to} from ${config.from}.\n`);
