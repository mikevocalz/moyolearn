-- Additive migration: `leads` gains the ADR-109 household pointer.
-- Apply with the Supabase MCP `apply_migration`, name: `leads_family_id_additive`.
-- Apply AFTER families_additive.sql — the stamp below reads that table.
--
-- HAND-EXTRACTED, for the reason every sibling records: no migration baseline,
-- so `payload migrate:create` re-emits the world. Everything below is additive
-- and idempotent: one nullable column, one index, and one UPDATE that writes
-- only NULL cells. It drops nothing and alters no existing column.
-- SOT: packages/payload/src/collections/Leads.ts (familyId) · docs/decisions/adr-109-family-household-object.md
-- SOT-KEYWORDS: leads family id migration sql additive supabase crm pointer stamp backfill

-- A pointer by convention (doc 13 §5), like `class_id` on assignments: varchar,
-- no FK — the join is a decision the read model makes, never one the schema
-- forces. Nullable, so adding it rewrites no existing row.
ALTER TABLE "payload"."leads"
  ADD COLUMN IF NOT EXISTS "family_id" varchar;

CREATE INDEX IF NOT EXISTS "leads_family_id_idx"
  ON "payload"."leads" USING btree ("family_id");

-- Stamp existing pipelines. NOT destructive DML: this is additive stamping of
-- a nullable column on existing rows — it writes only cells that are NULL
-- (`family_id IS NULL` is also what makes a re-run a no-op), it never
-- overwrites a stamp, and it deletes nothing. The join key is the same
-- (org_id, trimmed name) pair the families backfill inserted and the
-- service-side upsert writes.
UPDATE "payload"."leads" l
SET "family_id" = f."id"::varchar
FROM "payload"."families" f
WHERE l."family_id" IS NULL
  AND btrim(l."family") <> ''
  AND f."org_id" = l."org_id"
  AND f."name" = btrim(l."family");
