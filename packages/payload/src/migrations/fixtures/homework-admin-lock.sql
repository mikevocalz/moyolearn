-- Minimal prerequisite for homework_additive.sql's admin-lock foreign keys.
-- This is a migration test fixture, not a full Payload schema bootstrap.
-- The migration only needs the schema and a relation to add its three columns to.
CREATE SCHEMA payload;
CREATE TABLE payload.payload_locked_documents_rels (id serial PRIMARY KEY);
