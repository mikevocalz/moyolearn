-- Organization billing requires the Stripe plugin's organization customer column.
-- Apply once before deploying organization: { enabled: true }.
-- SOT: packages/auth/src/server.ts
-- SOT-KEYWORDS: better auth stripe organization billing migration
ALTER TABLE "better_auth"."organization"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;
