-- Additive migration for the two Organizations fields that shipped without one:
-- the `district` self-relationship and the `brandTheme` surface token.
-- Apply with the Supabase MCP `apply_migration`, name: `organizations_district_brand_theme`.
--
-- organizations_additive.sql predates both fields (it created name/slug/kind/
-- logo/accent only), so a database built from the shipped migrations rejects
-- every Organizations read with `column "district_id" does not exist` — found
-- by the walkthrough seed the moment it queried an org. Same hand-extracted
-- posture as the other additive files: nothing dropped, nothing altered, safe
-- to repeat.
-- SOT: packages/payload/src/collections/Organizations.ts
-- SOT-KEYWORDS: organizations district brand theme migration sql additive school hierarchy surface token

-- A school points at its district; a district is an organization whose `kind`
-- says so (no District collection — doc 01's rule, quoted in the collection).
ALTER TABLE "payload"."organizations" ADD COLUMN IF NOT EXISTS "district_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."organizations"
    ADD CONSTRAINT "organizations_district_id_organizations_id_fk"
    FOREIGN KEY ("district_id") REFERENCES "payload"."organizations"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "organizations_district_idx"
  ON "payload"."organizations" USING btree ("district_id");

-- The tenant's Moyo shell theme — a curated surface token, never a raw colour.
DO $$ BEGIN
  CREATE TYPE "payload"."enum_organizations_brand_theme"
    AS ENUM('lavender', 'guava', 'mint', 'mango-pastel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "payload"."organizations"
  ADD COLUMN IF NOT EXISTS "brand_theme" "payload"."enum_organizations_brand_theme" DEFAULT 'lavender';
