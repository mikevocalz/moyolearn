-- Optional organization customer reference required by @better-auth/stripe 1.7.2.
-- SOT: docs/pack/06-auth-onboarding-spec.md §4
-- SOT-KEYWORDS: billing stripe organization additive schema migration
-- Upstream: better-auth/better-auth v1.7.2 packages/stripe/src/schema.ts.
-- Run through apps/web/scripts/billing-migrate.mts --apply for the bounded,
-- advisory-locked transaction. No row data, grants or RLS policies are changed.
ALTER TABLE "better_auth"."organization"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;

-- IF NOT EXISTS must not silently accept a conflicting pre-existing column.
DO $billing_schema$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'better_auth' AND table_name = 'organization'
      AND column_name = 'stripeCustomerId'
      AND data_type = 'text' AND udt_schema = 'pg_catalog'
      AND udt_name = 'text' AND domain_name IS NULL
      AND is_nullable = 'YES' AND column_default IS NULL
      AND is_generated = 'NEVER' AND is_identity = 'NO'
  ) THEN
    RAISE EXCEPTION 'Organization billing requires an ordinary nullable text stripeCustomerId column without a default.'
      USING ERRCODE = '55000';
  END IF;
END
$billing_schema$;
