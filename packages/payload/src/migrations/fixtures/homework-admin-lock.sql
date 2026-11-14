-- Minimal prerequisites for homework_additive.sql's admin-lock foreign keys
-- and the real Payload update path's document-lock cleanup.
-- This is a migration test fixture, not a full Payload schema bootstrap.
CREATE SCHEMA payload;
CREATE TABLE payload.payload_locked_documents (
  id serial PRIMARY KEY,
  global_slug varchar,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE payload.payload_locked_documents_rels (
  id serial PRIMARY KEY,
  "order" integer,
  parent_id integer NOT NULL REFERENCES payload.payload_locked_documents(id) ON DELETE CASCADE,
  path varchar NOT NULL,
  users_id integer
);
-- homework_additive.sql adds the three homework collection relation columns.
