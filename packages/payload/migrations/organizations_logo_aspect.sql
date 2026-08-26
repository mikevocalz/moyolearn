-- Additive: per-district logo aspect for the co-branded lockup.
-- Apply with the Supabase MCP `apply_migration`, name: `organizations_logo_aspect`.
-- One enum, one nullable column with a default. Drops nothing, rewrites no row.
-- SOT-KEYWORDS: organizations logo aspect migration additive branding lockup
DO $$ BEGIN
  CREATE TYPE "payload"."enum_organizations_logo_aspect" AS ENUM('square', 'wide');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "payload"."organizations"
  ADD COLUMN IF NOT EXISTS "logo_aspect" "payload"."enum_organizations_logo_aspect" DEFAULT 'square';
