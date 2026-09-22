// @acme/auth/auth-email — the transactional sender behind Better Auth's
// `emailVerification.sendVerificationEmail`.
//
// It exists because doc 06 §6 requires verification in production and
// better-auth@1.7.2 refuses every unverified sign-in when no sender is
// configured (dist/api/routes/sign-in.mjs:340-352). Without this module the
// verification gate is a lock with no key cut for it.
//
// Resend's REST API over `fetch`, deliberately not the `resend` SDK: one POST
// with three headers does not justify a dependency in a package that Metro also
// has to resolve for the native app.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email verification resend sender transactional idempotency better-auth

import { createHash } from 'node:crypto';
import { isPlaceholderEmail } from './create-learner.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * `fetch` is injected rather than closed over so the request shape is testable
 * without a network. Derived from the global rather than hand-written: a
 * hand-written signature drifts from the runtime's the first time either moves.
 */
export type FetchLike = typeof globalThis.fetch;

export interface AuthEmailConfig {
  apiKey: string;
  /**
   * The envelope sender. NEVER defaulted — see `readAuthEmailConfig`.
   */
  from: string;
  /** Test seam. Omitted in production, where `globalThis.fetch` is correct. */
  fetch?: FetchLike;
}

export interface AuthEmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * The environment shape this module reads. Typed structurally rather than as
 * `NodeJS.ProcessEnv` so a test can pass a plain object literal.
 */
export type AuthEmailEnv = Readonly<Record<string, string | undefined>>;

const trimmed = (value: string | undefined): string => value?.trim() ?? '';

/**
 * Both variables or nothing.
 *
 * `from` is deliberately NOT defaulted. Resend hard-rejects a send from a
 * domain the account has not verified, so a default would produce a deployment
 * that looks configured — the sender is wired, the callback runs, no code path
 * reports a gap — while every verification mail 4xx's at the API. A missing
 * `from` has to be visible as a missing `from`.
 *
 * Whitespace-only counts as missing: a dashboard field someone cleared by
 * typing a space is not a configured sender, and `" "` would otherwise sail
 * through a truthiness check.
 */
export function readAuthEmailConfig(env: AuthEmailEnv = process.env): AuthEmailConfig | null {
  const apiKey = trimmed(env.RESEND_API_KEY);
  const from = trimmed(env.AUTH_EMAIL_FROM);
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/**
 * HTML-escape. `&` first, or the ampersand inserted by a later replacement gets
 * escaped a second time and `&amp;` renders as literal `&amp;amp;`.
 *
 * A verification URL reliably contains `&` (it carries both `token` and
 * `callbackURL`) and can contain `"` once a callback is percent-decoded, which
 * is the character that would otherwise close the `href` attribute early and
 * truncate the link to a dead one.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * The verification mail. One message for both triggers — Better Auth sends it
 * on sign-up AND on an unverified sign-in — so the copy cannot assume the
 * reader just created an account.
 *
 * "one hour" is not a guess: better-auth@1.7.2 defaults
 * `emailVerification.expiresIn` to 3600 seconds
 * (@better-auth/core/dist/types/init-options.d.mts), and this repo does not
 * override it. If that option is ever set, this sentence moves with it.
 */
export function verificationEmail(to: string, url: string): AuthEmailMessage {
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject: 'Confirm your email for Moyo',
    text: [
      'Confirm your email address to finish setting up your Moyo account:',
      '',
      url,
      '',
      "The link works for one hour. If you didn't ask for it, ignore this email — nothing changes until the link is opened.",
    ].join('\n'),
    html: [
      '<p>Confirm your email address to finish setting up your Moyo account:</p>',
      `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
      "<p>The link works for one hour. If you didn't ask for it, ignore this email — nothing changes until the link is opened.</p>",
    ].join('\n'),
  };
}

/**
 * A retry key that is stable per verification token and useless to whoever
 * holds it.
 *
 * The raw token is a signed JWT that grants the account — anyone who replays it
 * verifies that email. It must never leave this process for a third party, and
 * an `Idempotency-Key` header is exactly that: a value Resend stores, logs and
 * shows in its dashboard. The SHA-256 is one-way, and it is constant for a
 * given token, which is the whole property a retry needs.
 */
export function idempotencyKeyFor(token: string): string {
  return `verify-${createHash('sha256').update(token).digest('hex')}`;
}

/**
 * Resend's error envelope. Read defensively — a gateway 502 answers with HTML,
 * not with this shape.
 */
interface ResendErrorBody {
  message?: unknown;
  name?: unknown;
}

const reasonFrom = (body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed !== null && typeof parsed === 'object') {
      const { message, name } = parsed as ResendErrorBody;
      if (typeof message === 'string' && message.length > 0) return message;
      if (typeof name === 'string' && name.length > 0) return name;
    }
  } catch {
    // Not JSON. The raw body is still the most useful thing we have.
  }
  return body.slice(0, 300);
};

export interface SendAuthEmailOptions {
  idempotencyKey: string;
  /** Overrides `config.fetch`. Test seam; unused in production. */
  fetch?: FetchLike;
}

/**
 * Send one message. Throws on a non-2xx so Better Auth's own background-task
 * handling surfaces the failure instead of a silent no-op that looks like a
 * delivered mail.
 *
 * The thrown message carries the status and Resend's reason but NEVER the
 * recipient. This string lands in Vercel's runtime logs, and a bounce-heavy
 * auth path would otherwise write every address that failed to verify into a
 * log store with a different retention policy and a wider audience than the
 * user table. Resend's own reason text sometimes quotes the offending address
 * back ("Invalid `to` field"), so the address is redacted out of the reason
 * rather than merely left out of the sentence around it.
 */
export async function sendAuthEmail(
  config: AuthEmailConfig,
  message: AuthEmailMessage,
  options: SendAuthEmailOptions,
): Promise<void> {
  const send = options.fetch ?? config.fetch ?? globalThis.fetch;

  const response = await send(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': options.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (response.ok) return;

  const reason = reasonFrom(await response.text()).replaceAll(message.to, '[recipient]');
  throw new Error(`Resend rejected the verification email (HTTP ${response.status}): ${reason}`);
}

/**
 * What happened, so a caller and a test can both tell "we sent it" from "we
 * deliberately did not". A bare `void` return makes those two indistinguishable,
 * which is the shape that let the original bug hide.
 */
export type VerificationSendOutcome = 'sent' | 'skipped-no-address' | 'skipped-placeholder';

/**
 * The body of Better Auth's `emailVerification.sendVerificationEmail`, lifted
 * out of the options object so the policy is reachable by a test. An options
 * literal inside `betterAuth({ … })` can only be exercised by booting the whole
 * instance; this is the same code with a name.
 *
 * Refusing a placeholder address is the load-bearing branch. Doc 06 §2 gives a
 * managed learner no email, so `create-learner.ts` parks
 * `<uuid>@learners.invalid` in the column Better Auth makes required — an RFC
 * 2606 reserved TLD that is guaranteed never to resolve. Every send there is a
 * hard bounce charged against the sending domain's reputation, and it buys
 * nothing: a child has no inbox to confirm from, and doc 06 §2 routes that
 * account's recovery through the guardian instead. Learners are born verified
 * (payload-learner-writer.ts), so they never legitimately arrive here.
 */
export async function sendVerificationEmailFor(
  config: AuthEmailConfig,
  data: { user: { email?: string | null }; url: string; token: string },
  options?: { fetch?: FetchLike },
): Promise<VerificationSendOutcome> {
  const to = data.user.email;
  if (!to) return 'skipped-no-address';
  if (isPlaceholderEmail(to)) return 'skipped-placeholder';

  await sendAuthEmail(config, verificationEmail(to, data.url), {
    idempotencyKey: idempotencyKeyFor(data.token),
    ...(options?.fetch ? { fetch: options.fetch } : {}),
  });
  return 'sent';
}
