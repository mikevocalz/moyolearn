-- Additive migration for the `families` collection (doc 28 §2, ADR-109).
-- Apply with the Supabase MCP `apply_migration`, name: `families_collection`.
-- Apply BEFORE leads_family_id_additive.sql — that file's stamp reads this
-- table.
--
-- HAND-EXTRACTED, for the same reason classes_additive.sql was: this repo has
-- no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits every table, and dies on the first duplicate. Families
-- (packages/payload/src/collections/Families.ts) is the household object the
-- /families surface derived from lead text until ADR-109.
--
-- Everything below is additive and idempotent: three tables (Payload models
-- each array field as a side table), one unique constraint, indexes, one
-- locked-documents column, the privilege pins, and one backfill INSERT that
-- creates nothing but new rows. It drops nothing and alters no existing
-- column.
-- SOT: packages/payload/src/collections/Families.ts · docs/decisions/adr-109-family-household-object.md
-- SOT-KEYWORDS: families migration sql additive supabase crm household contacts learner refs backfill

CREATE TABLE IF NOT EXISTS "payload"."families" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" varchar NOT NULL,
  -- The household label the pipeline's `family` text becomes a pointer to.
  "name" varchar NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- The upsert key: lead creation upserts by (orgId, name) and the backfill
-- below inserts ON CONFLICT on the same pair — uniqueness is what makes both
-- idempotent. Both handlers, as classes_additive.sql has them: a duplicate
-- UNIQUE constraint surfaces as 42P07 `duplicate_table` (the backing index),
-- not `duplicate_object`.
DO $$ BEGIN
  ALTER TABLE "payload"."families"
    ADD CONSTRAINT "families_org_id_name_unique" UNIQUE ("org_id", "name");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "families_org_id_idx" ON "payload"."families" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "families_updated_at_idx" ON "payload"."families" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "families_created_at_idx" ON "payload"."families" USING btree ("created_at");

-- Payload models the `contacts` array field as a side table: `_order` and
-- `_parent_id` are drizzle's array-row columns, and `id` is the varchar row
-- key Payload mints per item. Doc 28 §2's GuardianContact as business contact
-- data — allowed on the CRM side; nothing here reaches learner data.
CREATE TABLE IF NOT EXISTS "payload"."families_contacts" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "relationship" varchar NOT NULL,
  "email" varchar,
  "phone" varchar
);

DO $$ BEGIN
  ALTER TABLE "payload"."families_contacts"
    ADD CONSTRAINT "families_contacts_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "payload"."families"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "families_contacts_order_idx"
  ON "payload"."families_contacts" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "families_contacts_parent_id_idx"
  ON "payload"."families_contacts" USING btree ("_parent_id");

-- Learner refs are text POINTERS out of the Operations Cloud (doc 28 §2's
-- LearnerRef): a varchar per row, no FK anywhere — the wall is that this
-- table structurally cannot join into learner data.
CREATE TABLE IF NOT EXISTS "payload"."families_learner_refs" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "ref" varchar NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."families_learner_refs"
    ADD CONSTRAINT "families_learner_refs_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "payload"."families"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "families_learner_refs_order_idx"
  ON "payload"."families_learner_refs" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "families_learner_refs_parent_id_idx"
  ON "payload"."families_learner_refs" USING btree ("_parent_id");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "families_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_families_fk"
    FOREIGN KEY ("families_id") REFERENCES "payload"."families"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_families_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("families_id");

-- Privileges, pinned as the siblings pin theirs — all three tables, since the
-- side tables carry the same class of data as their parent (a table of family
-- emails should not depend on a default set in a different migration).
REVOKE ALL ON TABLE "payload"."families" FROM anon, authenticated;
REVOKE ALL ON TABLE "payload"."families_contacts" FROM anon, authenticated;
REVOKE ALL ON TABLE "payload"."families_learner_refs" FROM anon, authenticated;

-- Backfill: every distinct household the pipeline already names becomes a row.
-- ADDITIVE by construction — it only ever inserts, and ON CONFLICT on the
-- upsert key makes a re-run a no-op rather than a duplicate. `btrim` matches
-- the derivation's key hygiene (family-groups.ts trimmed its grouping key) and
-- the service-side upsert, which receives the already-trimmed parse output —
-- three writers, one key.
INSERT INTO "payload"."families" ("org_id", "name")
SELECT DISTINCT "org_id", btrim("family")
FROM "payload"."leads"
WHERE btrim("family") <> ''
ON CONFLICT ("org_id", "name") DO NOTHING;
