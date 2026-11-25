// The guardian's account, created where the flow says "Your account".
//
// Until this file existed the account step stored an email address in the
// draft and moved on: no Better Auth call, no password, no account. Every step
// after it then ran against a session that did not exist, and the children
// step's `protectedOperation` refused with Unauthenticated. The sign-up is a
// function over a structural client so the test can hand it a recorder and
// assert exactly what was sent — the draft email, trimmed — without a server.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §5 §6
// SOT-KEYWORDS: guardian account sign up better auth email verification onboarding

/** Doc 06 §6 and `createAuth`'s `minPasswordLength`: one number, two readers. */
export const GUARDIAN_PASSWORD_MIN_LENGTH = 12;

export interface AuthClientError {
  code?: string;
  message?: string;
}

/** The Better Auth client resolves with `{ data, error }`; it does not throw. */
export interface AuthClientResult<T> {
  data: T | null;
  error: AuthClientError | null;
}

/**
 * The slice of the Better Auth client this step uses, typed structurally so a
 * test can pass a recorder. `createMoyoAuthClient()` satisfies it.
 */
export interface GuardianAuthClient {
  signUp: {
    email(input: {
      email: string;
      password: string;
      name: string;
      callbackURL?: string;
    }): Promise<AuthClientResult<{ token: string | null }>>;
  };
  signIn: {
    email(input: {
      email: string;
      password: string;
      callbackURL?: string;
    }): Promise<AuthClientResult<unknown>>;
  };
  sendVerificationEmail(input: { email: string; callbackURL?: string }): Promise<AuthClientResult<unknown>>;
}

export interface GuardianAccountInput {
  name: string;
  email: string;
  password: string;
}

export interface GuardianAccountProblems {
  name?: string;
  email?: string;
  password?: string;
}

/** Per field, live, like the child rows (H9): one lump message after submit is the shape Kit's onboarding avoids. */
export function guardianAccountProblems(input: GuardianAccountInput): GuardianAccountProblems {
  const problems: GuardianAccountProblems = {};
  if (!input.name.trim()) problems.name = 'Tell us what to call you.';
  if (!/.+@.+\..+/.test(input.email.trim())) problems.email = 'Enter the email you can read right now.';
  if (input.password.length < GUARDIAN_PASSWORD_MIN_LENGTH) {
    problems.password = 'Twelve characters or more — length beats symbols.';
  }
  return problems;
}

export const isGuardianAccountComplete = (input: GuardianAccountInput) =>
  Object.keys(guardianAccountProblems(input)).length === 0;

/**
 * Where the verification link lands. Native gets the app's own scheme — it is
 * a trusted origin in `createAuth`, and the pattern `moyo://` matches any path
 * under it — so the mail reopens the flow on the step that is waiting. A
 * browser gets the same path relative to its own origin, which is the one
 * absolute-URL shape `createAuth` would refuse avoided.
 */
export function verificationCallbackUrl(): string {
  return typeof document !== 'undefined' ? '/onboarding/guardian' : 'moyo://onboarding/guardian';
}

export type AccountOutcome =
  /** A session exists; the flow can move on. */
  | { kind: 'signed-in' }
  /** The account exists and nobody is signed in: the server wants the link opened first. */
  | { kind: 'verify-email'; address: string }
  | { kind: 'failed'; message: string; code?: string };

const FALLBACK_SIGNUP = 'We couldn’t create your account just now. Try again in a moment.';
const FALLBACK_SIGNIN = 'We couldn’t sign you in. Check your email and password and try again.';

/**
 * The messages that replace Better Auth's own for the two codes a parent will
 * actually meet. `USER_ALREADY_EXISTS` names the way out, because the server's
 * "User already exists" leaves them on a form that cannot finish.
 */
const SIGNUP_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS:
    'There’s already a Moyo account for that email. Sign in instead, or reset the password if you’ve forgotten it.',
  PASSWORD_TOO_SHORT: 'Twelve characters or more — length beats symbols.',
};

/**
 * Create the account. A missing token on success is the verification gate,
 * not an error: with `requireEmailVerification` on, Better Auth creates the
 * user and returns `token: null`, and `sendOnSignUp` has already sent the
 * link by the time this resolves. Pushing on anyway is the bug the web form
 * fixed first (LoginContent.tsx): a parent lands on a gated route and the
 * proxy bounces them to login with nothing on screen.
 */
export async function createGuardianAccount(
  client: GuardianAuthClient,
  input: GuardianAccountInput,
  options: { callbackURL?: string } = {},
): Promise<AccountOutcome> {
  const problems = guardianAccountProblems(input);
  const first = problems.name ?? problems.email ?? problems.password;
  if (first) return { kind: 'failed', message: first };

  // Autofill hands back a trailing space often enough that an untrimmed
  // address is a real lockout: the later sign-in misses and blames the password.
  const address = input.email.trim();
  try {
    const res = await client.signUp.email({
      email: address,
      password: input.password,
      name: input.name.trim(),
      callbackURL: options.callbackURL ?? verificationCallbackUrl(),
    });
    if (res.error) {
      const code = res.error.code;
      return {
        kind: 'failed',
        message: (code && SIGNUP_MESSAGES[code]) ?? res.error.message ?? FALLBACK_SIGNUP,
        code,
      };
    }
    if (!res.data?.token) return { kind: 'verify-email', address };
    return { kind: 'signed-in' };
  } catch (err) {
    // A genuine transport failure; the client resolves for every response it can parse.
    return { kind: 'failed', message: err instanceof Error ? err.message : FALLBACK_SIGNUP };
  }
}

/**
 * The step after the link: sign in with the password just chosen. The link
 * itself opened in the phone's browser, so the session it minted lives there
 * and not in the app's SecureStore — the app has to earn its own. An account
 * still unverified comes back `EMAIL_NOT_VERIFIED`, which is the notice again
 * (and Better Auth has re-sent the link, `sendOnSignIn`).
 */
export async function signInAfterVerification(
  client: GuardianAuthClient,
  input: { email: string; password: string },
): Promise<AccountOutcome> {
  const address = input.email.trim();
  try {
    const res = await client.signIn.email({ email: address, password: input.password, callbackURL: '/' });
    if (res.error?.code === 'EMAIL_NOT_VERIFIED') return { kind: 'verify-email', address };
    if (res.error) {
      return { kind: 'failed', message: res.error.message ?? FALLBACK_SIGNIN, code: res.error.code };
    }
    return { kind: 'signed-in' };
  } catch (err) {
    return { kind: 'failed', message: err instanceof Error ? err.message : FALLBACK_SIGNIN };
  }
}

/**
 * The manual resend. `/send-verification-email` answers `{ status: true }` for
 * an unknown or already-verified address on purpose (no enumeration), so the
 * only failure it can report is the sender — and that is the one worth a word.
 */
export async function resendVerification(
  client: GuardianAuthClient,
  email: string,
  callbackURL: string = verificationCallbackUrl(),
): Promise<boolean> {
  try {
    const res = await client.sendVerificationEmail({ email: email.trim(), callbackURL });
    return !res.error;
  } catch {
    return false;
  }
}

export const verifyNotice = (address: string) =>
  `Check your email. We sent a link to ${address}. Open it to confirm your account, then come back and continue.`;

export const resendFailed = 'We couldn’t send a new link just now. Try again in a moment.';
