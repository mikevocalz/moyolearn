// @acme/auth/auth-email — the transactional sender behind Better Auth's
// `emailVerification.sendVerificationEmail` and
// `emailAndPassword.sendResetPassword`.
//
// It exists because doc 06 §6 requires verification in production and
// better-auth@1.7.2 refuses every unverified sign-in when no sender is
// configured (dist/api/routes/sign-in.mjs:340-352). Without this module the
// verification gate is a lock with no key cut for it — and password reset
// (dist/api/routes/password.mjs:52) is the same lock one door over.
//
// Resend's REST API over `fetch`, deliberately not the `resend` SDK: one POST
// with three headers does not justify a dependency in a package that Metro also
// has to resolve for the native app.
//
// Nothing here runs at import time. `readAuthEmailConfig` is called by
// `createAuth`, so an environment with no sender loads this module cleanly and
// finds out at construction, where the gap is logged.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email verification reset password resend sender transactional idempotency better-auth

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
 * The two mails this module sends. The purpose prefixes the idempotency key so
 * a verification retry and a reset retry for the same account can never
 * collapse into one send, and it names the mail in the log line.
 */
export type AuthEmailPurpose = 'verify' | 'reset';

const PURPOSE_LABEL: Record<AuthEmailPurpose, string> = {
  verify: 'verification email',
  reset: 'password reset email',
};

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
 * The password reset mail. `url` arrives from Better Auth already carrying the
 * caller's `redirectTo` as `callbackURL`
 * (`${baseURL}/reset-password/${token}?callbackURL=${redirectTo}`,
 * dist/api/routes/password.mjs:81-82); opening it lands on that page with
 * `?token=` appended, or `?error=INVALID_TOKEN` once it has expired. The mail
 * therefore carries the URL untouched — rebuilding it here would be a second
 * copy of that routing rule waiting to disagree with the first.
 *
 * "one hour" is `resetPasswordTokenExpiresIn`'s default (3600, password.mjs:73)
 * and this repo does not override it.
 */
export function resetPasswordEmail(to: string, url: string): AuthEmailMessage {
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject: 'Reset your Moyo password',
    text: [
      'Choose a new password for your Moyo account:',
      '',
      url,
      '',
      "The link works for one hour. If you didn't ask for it, ignore this email — your password stays as it is.",
    ].join('\n'),
    html: [
      '<p>Choose a new password for your Moyo account:</p>',
      `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
      "<p>The link works for one hour. If you didn't ask for it, ignore this email — your password stays as it is.</p>",
    ].join('\n'),
  };
}

/**
 * A retry key that is stable per (purpose, account, token) and useless to
 * whoever holds it.
 *
 * The raw verification token is a signed JWT that grants the account — anyone
 * who replays it verifies that email. It must never leave this process for a
 * third party, and an `Idempotency-Key` header is exactly that: a value Resend
 * stores, logs and shows in its dashboard. The SHA-256 is one-way, and it is
 * constant for a given input, which is the whole property a retry needs.
 *
 * The user id is folded in so the key is scoped to the account as well as the
 * token; the purpose is a plain prefix so a verification and a reset for the
 * same account are two sends, never one.
 */
export function idempotencyKeyFor(purpose: AuthEmailPurpose, userId: string, token: string): string {
  return `${purpose}-${createHash('sha256').update(`${userId}:${token}`).digest('hex')}`;
}

/**
 * The one error class every failure in this module throws. `name` is fixed so
 * a log query or an alert can match on it rather than on message text that
 * moves with the copy. `status` is 0 when Resend could not be reached at all.
 */
export class AuthEmailSendError extends Error {
  override readonly name = 'AuthEmailSendError';
  readonly purpose: AuthEmailPurpose;
  readonly status: number;

  // Plain fields, not parameter properties: the test runner and the proof
  // script load this file under Node's strip-only TypeScript mode, which
  // refuses `constructor(readonly x)` outright.
  constructor(
    purpose: AuthEmailPurpose,
    status: number,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(
      status === 0
        ? `Resend could not be reached for the ${PURPOSE_LABEL[purpose]}: ${reason}`
        : `Resend rejected the ${PURPOSE_LABEL[purpose]} (HTTP ${status}): ${reason}`,
      options,
    );
    this.purpose = purpose;
    this.status = status;
  }
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
  purpose: AuthEmailPurpose;
  idempotencyKey: string;
  /** Overrides `config.fetch`. Test seam; unused in production. */
  fetch?: FetchLike;
}

/**
 * Send one message. Throws `AuthEmailSendError` on a non-2xx or an unreachable
 * API so Better Auth's own handling surfaces the failure instead of a silent
 * no-op that looks like a delivered mail.
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
  const redact = (text: string) => text.replaceAll(message.to, '[recipient]');

  let response: Response;
  try {
    response = await send(RESEND_ENDPOINT, {
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
  } catch (cause) {
    const reason = cause instanceof Error ? redact(cause.message) : 'unknown network failure';
    throw new AuthEmailSendError(options.purpose, 0, reason, { cause });
  }

  if (response.ok) return;
  throw new AuthEmailSendError(options.purpose, response.status, redact(reasonFrom(await response.text())));
}

/**
 * What happened, so a caller and a test can both tell "we sent it" from "we
 * deliberately did not". A bare `void` return makes those two indistinguishable,
 * which is the shape that let the original bug hide.
 */
export type SendOutcome = 'sent' | 'skipped-no-address' | 'skipped-placeholder';

/**
 * The slice of Better Auth's `User` the two callbacks read. `id` is required —
 * it scopes the idempotency key — and `email` is optional only because the
 * caller shape allows it; Better Auth always supplies both.
 */
export interface AuthEmailRecipient {
  id: string;
  email?: string | null;
}

export interface AuthEmailCallbackData {
  user: AuthEmailRecipient;
  url: string;
  token: string;
}

/**
 * The shared body of both Better Auth callbacks, lifted out of the options
 * object so the policy is reachable by a test. An options literal inside
 * `betterAuth({ … })` can only be exercised by booting the whole instance; this
 * is the same code with a name.
 *
 * Refusing a placeholder address is the load-bearing branch. Doc 06 §2 gives a
 * managed learner no email, so `create-learner.ts` parks
 * `<uuid>@learners.invalid` in the column Better Auth makes required — an RFC
 * 2606 reserved TLD that is guaranteed never to resolve. Every send there is a
 * hard bounce charged against the sending domain's reputation, and it buys
 * nothing: a child has no inbox to confirm from, and doc 06 §2 routes both
 * that account's verification and its password reset through the guardian.
 *
 * A failure is LOGGED HERE AND RETHROWN. This is the boundary Better Auth
 * calls: sign-in awaits it (`runInBackgroundOrAwait`, no background handler
 * is configured), so the rethrow turns a dead sender into a 500 rather than a
 * 403 that tells the reader "we just sent a link" when nothing went out. The
 * log line carries the stable class name and status, never the address.
 */
async function deliver(
  config: AuthEmailConfig,
  purpose: AuthEmailPurpose,
  compose: (to: string, url: string) => AuthEmailMessage,
  data: AuthEmailCallbackData,
  options?: { fetch?: FetchLike },
): Promise<SendOutcome> {
  const to = data.user.email;
  if (!to) return 'skipped-no-address';
  if (isPlaceholderEmail(to)) return 'skipped-placeholder';

  try {
    await sendAuthEmail(config, compose(to, data.url), {
      purpose,
      idempotencyKey: idempotencyKeyFor(purpose, data.user.id, data.token),
      ...(options?.fetch ? { fetch: options.fetch } : {}),
    });
  } catch (error) {
    const detail =
      error instanceof AuthEmailSendError
        ? { error: error.name, status: error.status }
        : { error: error instanceof Error ? error.name : typeof error };
    console.error(`[auth-email] ${PURPOSE_LABEL[purpose]} failed for user ${data.user.id}`, detail);
    throw error;
  }
  return 'sent';
}

/** Better Auth's `emailVerification.sendVerificationEmail`. */
export function sendVerificationEmailFor(
  config: AuthEmailConfig,
  data: AuthEmailCallbackData,
  options?: { fetch?: FetchLike },
): Promise<SendOutcome> {
  return deliver(config, 'verify', verificationEmail, data, options);
}

/** Better Auth's `emailAndPassword.sendResetPassword`. */
export function sendResetPasswordEmailFor(
  config: AuthEmailConfig,
  data: AuthEmailCallbackData,
  options?: { fetch?: FetchLike },
): Promise<SendOutcome> {
  return deliver(config, 'reset', resetPasswordEmail, data, options);
}
