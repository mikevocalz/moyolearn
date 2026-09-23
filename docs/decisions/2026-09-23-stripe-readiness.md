# Stripe billing readiness — 2026-09-23

SOT-KEYWORDS: stripe billing release configuration migration revenuecat readiness

PR #36 remains blocked on deployment credentials and payment-flow verification.
This records checks performed against the actual configuration, rather than
assuming the prior review's environment inventory is still current.

## Completed

- Merged `origin/main` (`829bb71`) into `codex/moyo-stripe-setup`.
- Tested the actual billing middleware for managed learners, minors, adults,
  missing sessions, malformed sessions, and the subscription-success exemption.
- Malformed sessions now return `UNAUTHORIZED` instead of a Zod exception.
- Removed the unused plan authorization implementation and its misleading tests;
  the route guard and the plugin's organization membership callback remain the
  enforcement points. Owner/finance role tests remain.
- Removed the redundant trusted-origin wildcard, shared the email-verification
  setting between sign-in and checkout, and made the integration label overridable.
- Documented the RevenueCat import-before-enable requirement in `.env.example`.
- Applied `packages/payload/migrations/better_auth_stripe_organization.sql` to
  the database selected by the main workspace's `.env.local`. Verified
  `better_auth.organization.stripeCustomerId` exists as nullable `text`.
  No separate Preview database has been configured or verified.

## Deployment evidence

Vercel project `moyo-app` (`prj_uJ8B9iXgebbLOTjdCA3X5iI4UVeN`):

- Production has the family, early-bird, ops, and additional-child price IDs,
  and `REVENUECAT_STRIPE_API_KEY`.
- Neither `STRIPE_SECRET_KEY` nor `STRIPE_WEBHOOK_SECRET` is configured.
- `REVENUECAT_ENABLED` and `REVENUECAT_SECRET_API_KEY` are absent.
- There are no Preview-scoped Stripe, RevenueCat, or database variables.
- Environment values were not printed or committed.

Stripe account `acct_1PPvk9P0FfmQL9jX` has the existing live webhook
`we_1UHEhnP0FfmQL9jX0tddFiLQ` at
`https://app.moyolearn.com/api/auth/stripe/webhook`. It is disabled and includes
checkout completion, subscription creation/update/deletion, invoice paid, and
invoice payment failure. It was not enabled while the server secrets are absent.

The locally authenticated Stripe CLI points to a different account; it must not
be used to configure Moyo's billing. The connected Stripe tool exposes the Moyo
live account only, and cannot retrieve the server's existing secret API key.

## Activation requirements

1. In Vercel's sensitive environment settings, configure the Moyo restricted
   Stripe API key and the existing endpoint's signing secret for Production.
2. Configure Preview with a test-mode key, test prices, its own webhook signing
   secret, and a database with the required auth schema. Do not copy live prices
   into Preview.
3. Deploy the PR to Preview and verify checkout, signed webhook delivery,
   entitlement confirmation, portal access, cancellation, and payment failure.
4. For RevenueCat, verify project/products/entitlement and server API access.
   Enable before real Stripe purchases begin, or import all existing family
   subscriptions before switching entitlement reads. Store purchase and restore
   verification still requires the configured stores and a new native build.
5. Deploy the verified configuration before enabling the live webhook.

Automatic tax has not been enabled. An active tax registration must be verified
before enabling it; no tax-configuration change was made in this follow-up.

The original PR also identifies separate product release gaps: additional-child
capacity enforcement, founding-plan eligibility/caps, trial reminder delivery,
and organization checkout/management UI. These have not been completed by this
server authorization follow-up.

## Validation

- `corepack pnpm --filter @acme/auth test`: 130 passed.
- `corepack pnpm --filter @acme/auth lint`: passed.
- `corepack pnpm typecheck --force`: 19 successful, zero cached.
- `git diff --check`: passed.
- No checkout, customer charge, or native store purchase was performed.
