-- `edu.embeddings` — the retrieval half of doc 12 §4's educational store.
-- Apply with the Supabase MCP `apply_migration`, name: `edu_embeddings_pgvector`.
-- Requires `edu_schema` (the schema, the domains and `edu.transcripts`) first.
--
-- CHECKED BEFORE WRITING, not assumed: `select * from pg_available_extensions
-- where name = 'vector'` returns `vector 0.8.2`, uninstalled. It is installed
-- below into `extensions`, which is where Supabase keeps extensions and where
-- pgcrypto and uuid-ossp already live on this project. Every reference to the
-- type and its operator class is schema-qualified, so this file does not depend
-- on whatever `search_path` the applying session happens to carry.
--
-- Doc 19 §5.5 is the binding rule and it is narrower than "vectors for
-- retrieval": EMBED CONTENT, TAG CHILDREN. The student model is structured data
-- — that is `edu.knowledge_graph` — and a learner is never represented as a
-- vector. Two categories of row are legal here and the CHECK below admits no
-- third:
--
--   'content'    — curriculum, worked examples, items, taxonomy entries. Not
--                  learner data; no learner column is even nullable-present.
--   'transcript' — doc 19 §5.5 item 3, semantic recall inside the retention
--                  window. "An embedding of learner content IS learner content",
--                  so these inherit the transcript's TTL and its erasure —
--                  structurally, by foreign key, not by a job that must remember.
--
-- Doc 19 §5.5 item 2's misconception-classification vector is deliberately
-- absent: that embedding is TRANSIENT, an input to the classifier, and the
-- structured tag is what gets stored. A table for it would be the bug.
--
-- Additive and idempotent: one extension, one enum, one table, four indexes.
-- SOT: docs/pack/19-learning-outcomes-spec.md §5.5 · docs/pack/12-systems-design-prompt.md §4 · packages/payload/migrations/edu_schema.sql
-- SOT-KEYWORDS: edu embeddings pgvector hnsw retrieval rag curriculum transcript ttl cascade migration additive supabase

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

DO $$ BEGIN
  CREATE TYPE "edu"."embedding_kind" AS ENUM('content', 'transcript');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "edu"."embeddings" (
  "id"   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "kind" "edu"."embedding_kind" NOT NULL,

  -- 'content' rows only: the curriculum item, worked example or taxonomy entry.
  "content_id" "edu"."opaque_id",

  -- 'transcript' rows only. ON DELETE CASCADE is the whole design: doc 19 §5.5
  -- says these embeddings "inherit the transcript TTL and erasure cascade
  -- exactly", and a foreign key is the only way to say that which cannot be
  -- forgotten by the next person who writes a sweep. A retention pass that
  -- deletes a transcript deletes its vectors in the same statement, whether or
  -- not it knows this table exists.
  "transcript_id" "edu"."opaque_id"
    REFERENCES "edu"."transcripts"("session_id") ON DELETE CASCADE,
  "learner_id" "edu"."opaque_id",

  -- Which model produced the vector. Stored per row because a dimension change
  -- is a new column type and therefore a new migration, but a model swap at the
  -- SAME dimension is not — and cosine distance between two models' vectors is
  -- a number with no meaning. Retrieval filters on this.
  "model" "edu"."opaque_id" NOT NULL,

  -- Doc 19 §5.5: "one embedding model chosen at the implementing PR with its
  -- dimension fixed in the migration". PINNED AT 1024. The number cannot be
  -- widened in place, so it is a real commitment — but the table ships EMPTY
  -- with no writer, and no server-side embedding call exists in the repo yet
  -- (`packages/student-model/src/inference.ts` declares `ModelStreamCall` and
  -- nothing else), so today the pin costs one migration to change and after the
  -- first row it costs a backfill. Changing it later is a new migration plus an
  -- index rebuild, deliberately.
  "embedding" extensions."vector"(1024) NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,

  -- The rule stated as a constraint. A content row has no learner; a transcript
  -- row has one and has a transcript to hang from. There is no way to write a
  -- learner-scoped vector that the cascade cannot reach.
  CONSTRAINT "embeddings_owner_shape" CHECK (
    CASE "kind"
      WHEN 'content' THEN
        "content_id" IS NOT NULL AND "transcript_id" IS NULL AND "learner_id" IS NULL
      WHEN 'transcript' THEN
        "transcript_id" IS NOT NULL AND "learner_id" IS NOT NULL AND "content_id" IS NULL
    END
  )
);

-- Doc 19 §5.5 pins HNSW. Cosine, because the retrieval question is "closest in
-- meaning" and normalising every vector to make L2 equivalent is a step the
-- gateway would have to remember on every write.
CREATE INDEX IF NOT EXISTS "edu_embeddings_hnsw_idx"
  ON "edu"."embeddings" USING hnsw ("embedding" extensions."vector_cosine_ops");

CREATE INDEX IF NOT EXISTS "edu_embeddings_transcript_idx"
  ON "edu"."embeddings" USING btree ("transcript_id");
CREATE INDEX IF NOT EXISTS "edu_embeddings_learner_idx"
  ON "edu"."embeddings" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "edu_embeddings_content_idx"
  ON "edu"."embeddings" USING btree ("content_id")
  WHERE "kind" = 'content';

-- Same posture as everything else in this schema. The ALTER DEFAULT PRIVILEGES
-- from `edu_schema` already covers a table created afterwards; these REVOKEs pin
-- the state for a table created before that migration is re-applied.
REVOKE ALL ON "edu"."embeddings" FROM anon, authenticated;
ALTER TABLE "edu"."embeddings" ENABLE ROW LEVEL SECURITY;
