// @acme/auth/auth-email — the transactional sender behind Better Auth's
// `emailVerification.sendVerificationEmail` and
// `emailAndPassword.sendResetPassword`.
//
// It exists because doc 06 §6 requires verification in production and
// better-auth@1.7.2 refuses every unverified sign-in when no sender is
// configured (dist/api/routes/sign-in.mjs:340-352). Without this module the
// verification gate is a lock with no key cut for it.
//
// The reset half fails differently and loudly: with no `sendResetPassword`,
// `/request-password-reset` logs "Reset password isn't enabled" and throws
// BAD_REQUEST `RESET_PASSWORD_DISABLED` (dist/api/routes/password.mjs:53-56).
// It is a refusal with a reason, not the silent no-op it was first recorded as.
//
// Resend's REST API over `fetch`, deliberately not the `resend` SDK: one POST
// with three headers does not justify a dependency in a package that Metro also
// has to resolve for the native app.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/decisions/2026-09-23-reset-password-contract.md · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email verification password reset resend sender transactional idempotency better-auth

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

/**
 * The two mails this module sends, each carrying the pair of strings that must
 * never disagree: the idempotency-key prefix Resend sees, and the label a
 * failure is logged under.
 *
 * One map rather than two constants, because the pair is the point. Both values
 * used to be hardcoded to the verification case — `verify-` inside
 * `idempotencyKeyFor` and "the verification email" inside the thrown error — so
 * a second caller would have inherited both and every reset failure would have
 * been read off a log line naming the wrong flow.
 *
 * The prefix is not cosmetic. Resend's idempotency keys are account-global, so
 * two kinds sharing one prefix can collide there even though the tokens come
 * from different generators (a signed JWT for verification, an opaque
 * `generateId(24)` for reset).
 */
const AUTH_EMAIL_KINDS = {
  verification: { keyPrefix: 'verify', label: 'verification' },
  'password-reset': { keyPrefix: 'reset', label: 'password reset' },
} as const satisfies Record<string, { keyPrefix: string; label: string }>;

export type AuthEmailKind = keyof typeof AUTH_EMAIL_KINDS;

export interface AuthEmailMessage {
  /** Selects the idempotency prefix and the failure label. */
  kind: AuthEmailKind;
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
 * Both links reliably contain `&` (each carries `token` and `callbackURL`) and
 * can contain `"` once a callback is percent-decoded, which is the character
 * that would otherwise close the `href` attribute early and truncate the link
 * to a dead one.
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
    kind: 'verification',
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
 * The password-reset mail.
 *
 * The reader did not necessarily ask for this, and the endpoint answers the
 * same way whether the address has an account or not, so the copy opens by
 * saying what arrived rather than congratulating anyone on a request they may
 * not have made. Nothing here is framed as a problem: asking for a reset is a
 * supported way to get back in, and "error"-shaped wording would make an
 * ordinary act read as a mistake.
 *
 * "one hour" is measured, not guessed: better-auth@1.7.2 falls back to
 * `resetPasswordTokenExpiresIn || 3600`
 * (@better-auth/core/dist/types/init-options.d.mts:711) and this repo does not
 * set it. If it is ever set, this sentence moves with it.
 *
 * The link text is the URL itself, matching `verificationEmail`. A screen
 * reader reads the whole thing aloud, which is verbose, but a recipient who
 * cannot click needs the address visible, and a recipient deciding whether to
 * trust the mail at all needs to see where it goes before following it.
 */
export function resetPasswordEmail(to: string, url: string): AuthEmailMessage {
  const safeUrl = escapeHtml(url);
  const closing =
    "The link works for one hour. If you didn't ask for it, ignore this email — your password stays as it is until the link is opened.";
  return {
    kind: 'password-reset',
    to,
    subject: 'Reset your Moyo password',
    text: [
      'Someone asked to reset the password on your Moyo account. If that was you, set a new one here:',
      '',
      url,
      '',
      closing,
    ].join('\n'),
    html: [
      '<p>Someone asked to reset the password on your Moyo account. If that was you, set a new one here:</p>',
      `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
      `<p>${closing}</p>`,
    ].join('\n'),
  };
}

/**
 * A retry key that is stable per token and useless to whoever holds it.
 *
 * Both tokens are bearer credentials: the verification JWT verifies that email,
 * and the reset id sets that account's password on its own. Neither may leave
 * this process for a third party, and an `Idempotency-Key` header is exactly
 * that — a value Resend stores, logs and shows in its dashboard. The SHA-256 is
 * one-way, and it is constant for a given token, which is the whole property a
 * retry needs.
 *
 * `kind` is required rather than defaulted to the older verification case. A
 * third mail added later would otherwise mint keys in the verification
 * namespace without anyone writing the word "verify".
 */
export function idempotencyKeyFor(token: string, kind: AuthEmailKind): string {
  return `${AUTH_EMAIL_KINDS[kind].keyPrefix}-${createHash('sha256').update(token).digest('hex')}`;
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

/**
 * The one error class every send failure in this module throws. `name` is
 * fixed so a log query or an alert can match on it rather than on message text
 * that moves with the copy. `status` is 0 when Resend could not be reached at
 * all — a DNS or TLS failure used to escape as a bare `TypeError: fetch failed`
 * that named neither the flow nor the provider.
 */
export class AuthEmailSendError extends Error {
  override readonly name = 'AuthEmailSendError';
  readonly kind: AuthEmailKind;
  readonly status: number;

  // Plain fields, not parameter properties: the test runner and the proof
  // script load this file under Node's strip-only TypeScript mode, which
  // refuses `constructor(readonly x)` outright.
  constructor(kind: AuthEmailKind, status: number, reason: string, options?: { cause?: unknown }) {
    const { label } = AUTH_EMAIL_KINDS[kind];
    super(
      status === 0
        ? `Resend could not be reached for the ${label} email: ${reason}`
        : `Resend rejected the ${label} email (HTTP ${status}): ${reason}`,
      options,
    );
    this.kind = kind;
    this.status = status;
  }
}

export interface SendAuthEmailOptions {
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
 *
 * Which flow failed comes from `message.kind`, not from the caller. Reading it
 * off the message is what makes the two labels impossible to swap: there is no
 * argument to pass wrongly.
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
    throw new AuthEmailSendError(message.kind, 0, reason, { cause });
  }

  if (response.ok) return;
  throw new AuthEmailSendError(
    message.kind,
    response.status,
    redact(reasonFrom(await response.text())),
  );
}

/**
 * What happened, so a caller and a test can both tell "we sent it" from "we
 * deliberately did not". A bare `void` return makes those two indistinguishable,
 * which is the shape that let the original bug hide.
 *
 * One union for both senders. The three outcomes are a property of the address,
 * not of the mail, so a second copy would only ever be the same three strings
 * under a name that could drift.
 */
export type AuthEmailSendOutcome = 'sent' | 'skipped-no-address' | 'skipped-placeholder';

/**
 * The slice of Better Auth's `User` both callbacks read. `id` is optional only
 * because the tests build bare recipients; Better Auth always supplies it.
 */
export interface AuthEmailCallbackData {
  user: { id?: string; email?: string | null };
  url: string;
  token: string;
}

/**
 * The boundary Better Auth calls, so the failure is LOGGED HERE AND RETHROWN.
 * Sign-in awaits the sender (`runInBackgroundOrAwait`, no background handler is
 * configured), so the rethrow turns a dead sender into a 500 rather than a 403
 * telling the reader "we just sent a link" when nothing went out. The log line
 * carries the stable class name, kind and status — never the address.
 */
async function sendLogged(
  config: AuthEmailConfig,
  message: AuthEmailMessage,
  data: AuthEmailCallbackData,
  options: SendAuthEmailOptions,
): Promise<void> {
  try {
    await sendAuthEmail(config, message, options);
  } catch (error) {
    const detail =
      error instanceof AuthEmailSendError
        ? { error: error.name, kind: error.kind, status: error.status }
        : { error: error instanceof Error ? error.name : typeof error, kind: message.kind };
    console.error(
      `[auth-email] ${AUTH_EMAIL_KINDS[message.kind].label} email failed for user ${data.user.id ?? 'unknown'}`,
      detail,
    );
    throw error;
  }
}

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
  data: AuthEmailCallbackData,
  options?: { fetch?: FetchLike },
): Promise<AuthEmailSendOutcome> {
  const to = data.user.email;
  if (!to) return 'skipped-no-address';
  if (isPlaceholderEmail(to)) return 'skipped-placeholder';

  await sendLogged(config, verificationEmail(to, data.url), data, {
    idempotencyKey: idempotencyKeyFor(data.token, 'verification'),
    ...(options?.fetch ? { fetch: options.fetch } : {}),
  });
  return 'sent';
}

/**
 * The body of Better Auth's `emailAndPassword.sendResetPassword`, lifted out of
 * the options literal for the same reason as its verification twin: a callback
 * declared inside `betterAuth({ … })` can only be exercised by booting the
 * whole instance.
 *
 * Refusing a placeholder address is the only control this package has over a
 * managed learner's reset, and it is not the control that looks like it.
 * `isRestrictedLearnerPasswordChange` (server.ts) reads as though it covers
 * this, but it requires `actorId === owner.id`, and `/reset-password` runs with
 * no session — `ctx.context.session` is undefined, the guard declines, and the
 * password change proceeds. So the block has to happen before a link exists.
 * Doc 06 §2 routes a managed learner's recovery through the guardian and never
 * through `<uuid>@learners.invalid`; this refusal is what holds that, and it
 * also spares the sending domain a guaranteed hard bounce.
 *
 * Refusing still leaves an unused `reset-password:` verification row behind:
 * better-auth mints it before it calls this sender, and no hook available to
 * this package runs earlier. It expires in an hour and authorises nothing that
 * was not already authorised, since nobody ever receives the token.
 */
export async function sendResetPasswordFor(
  config: AuthEmailConfig,
  data: AuthEmailCallbackData,
  options?: { fetch?: FetchLike },
): Promise<AuthEmailSendOutcome> {
  const to = data.user.email;
  if (!to) return 'skipped-no-address';
  if (isPlaceholderEmail(to)) return 'skipped-placeholder';

  await sendLogged(config, resetPasswordEmail(to, data.url), data, {
    idempotencyKey: idempotencyKeyFor(data.token, 'password-reset'),
    ...(options?.fetch ? { fetch: options.fetch } : {}),
  });
  return 'sent';
}
