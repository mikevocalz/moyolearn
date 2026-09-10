-- The whiteboard column on `tutorSessions` (doc 23 §5).
-- Apply with the Supabase MCP `apply_migration`, name: `tutor_sessions_board`.
--
-- HAND-EXTRACTED, for the reason tutor_sessions_additive.sql already records:
-- this repo has no migration baseline, so `payload migrate:create` treats every
-- run as INITIAL, emits all 31 tables, dies on the first `CREATE TABLE "users"`
-- and offers a down() that drops the production schema.
--
-- One nullable text column. It drops nothing, alters no existing column, and
-- rewrites no existing row — Postgres adds a nullable column with no default as
-- a catalogue-only change, so this does not take a rewrite lock on a table the
-- tutor session reads on every mount.
--
-- TEXT AND NOT `jsonb`, though every other document column here is jsonb. The
-- value is a base64 Yjs update: opaque bytes that nothing on the server ever
-- decodes, which is deliberate for a child's scratch paper — the fewer places
-- that can read it, the better — and jsonb would buy indexing and validation
-- for a value nobody queries and nobody parses.
--
-- Written by MERGE rather than by replace (`mergeBoard` in
-- apps/web/lib/tutor-session.repository.ts): Yjs updates commute, so folding two
-- together keeps both devices' strokes. The write is still a read-modify-write
-- and can still lose a race; what makes that survivable is that a device pushes
-- its whole document every time, so a lost merge is repaired by the next push.
-- SOT: packages/app/features/tutor/board-doc.ts · packages/payload/src/collections/TutorSessions.ts
-- SOT-KEYWORDS: tutor sessions board whiteboard migration sql additive yjs crdt column

ALTER TABLE "payload"."tutor_sessions"
  ADD COLUMN IF NOT EXISTS "board" varchar;
