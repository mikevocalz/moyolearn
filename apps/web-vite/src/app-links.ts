/**
 * The product lives on its own origin. Every marketing link into it goes
 * through here.
 *
 * The nav, the hero, chapter 08 and the footer each used to spell their own
 * destination against `SITE_ORIGIN` — `https://moyolearn.com/login` and
 * `/signup` — which are routes this site does not serve, so both header
 * buttons 500'd. Absolute is still required (the prerender crawls any href
 * starting with `/` and fails the build on a 404); it just has to be absolute
 * against the APP.
 *
 * `/signup` does not exist: `apps/web/app/(auth)/login` is one form with a
 * signin/signup mode, and `?mode=signup` opens it on Create account.
 *
 * SOT: docs/pack/38-front-door-and-flow.md (FD-02, FD-03) · apps/web/app/(auth)
 * SOT-KEYWORDS: app origin front door login signup onboarding cross-origin cta
 */
export const APP_ORIGIN = 'https://app.moyolearn.com';

/** FD-02 — sign in. */
export const APP_LOGIN = `${APP_ORIGIN}/login`;
/** FD-03 — create an account (the login form, opened in signup mode). */
export const APP_START = `${APP_ORIGIN}/login?mode=signup`;
/** FD-08 — the learner sequence, where a kid with a code belongs. */
export const APP_LEARNER = `${APP_ORIGIN}/onboarding/learner`;
