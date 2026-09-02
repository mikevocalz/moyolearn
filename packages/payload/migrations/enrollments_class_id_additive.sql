-- Additive migration: the `classId` dimension on `enrollments`.
-- Apply with the Supabase MCP `apply_migration`, name: `enrollments_class_id`.
--
-- One nullable column and its index — the roster's class dimension. A column
-- on the existing roster rather than a second roster collection: one student,
-- one row, and teacher.classes reads a class roster by this index instead of
-- joining a parallel table (design/screens/teacher/teacher.classes/contract.md,
-- state_owner: "server (classes/Enrollments)").
-- SOT: packages/payload/src/collections/Enrollments.ts · packages/payload/src/collections/Classes.ts
-- SOT-KEYWORDS: enrollments class id migration sql additive roster dimension teacher classes

ALTER TABLE "payload"."enrollments"
  ADD COLUMN IF NOT EXISTS "class_id" varchar;

CREATE INDEX IF NOT EXISTS "enrollments_class_id_idx"
  ON "payload"."enrollments" USING btree ("class_id");
