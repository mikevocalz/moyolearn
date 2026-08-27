-- Doc 31 §2.1: `users.grade_band` goes from the plane's two-value policy
-- register to the four voice bands.
-- Apply with the Supabase MCP `apply_migration`, name: `users_voice_bands`.
--
-- HAND-EXTRACTED, for the reason every other migration here records: this repo
-- has no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL and offers a down() that drops the production schema.
--
-- WHY A TYPE SWAP RATHER THAN `ALTER TYPE ... ADD VALUE`. Adding labels is the
-- one-liner, but it leaves `young` and `older` in the enum forever, which means
-- the two values doc 31 is about stay writable and a stale client keeps writing
-- them. Building the new type and swapping is the version where the old values
-- become unrepresentable, which is the point of the change.
--
-- The mapping is the same one `asVoiceBand` applies on read, and it is the
-- reason nothing has to be backfilled by hand or guessed at later:
--   young -> k-2    a learner marked young is the band doc 31 was written about
--   older -> 9-12   the unsimplified register, which is what `older` selected
--
-- Idempotent and additive in effect: no row is deleted and no column is dropped.
-- SOT: docs/pack/31-grade-voice-safety-incidents.md §2 · packages/payload/src/collections/Users.ts
-- SOT-KEYWORDS: users grade band voice band migration enum k-2 3-5 6-8 9-12 doc 31

DO $$
BEGIN
  -- Already swapped? Then this migration has run and re-running it must not
  -- rebuild a type other objects now depend on.
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'payload' AND t.typname = 'enum_users_grade_band' AND e.enumlabel = 'k-2'
  ) THEN
    RAISE NOTICE 'users_voice_bands: already applied';
    RETURN;
  END IF;

  CREATE TYPE "payload"."enum_users_grade_band_v2" AS ENUM ('k-2', '3-5', '6-8', '9-12');

  -- The default has to go before the cast: Postgres validates the existing
  -- DEFAULT against the new type mid-ALTER and fails on `'older'`.
  ALTER TABLE "payload"."users" ALTER COLUMN "grade_band" DROP DEFAULT;

  ALTER TABLE "payload"."users"
    ALTER COLUMN "grade_band" TYPE "payload"."enum_users_grade_band_v2"
    USING (
      CASE "grade_band"::text
        WHEN 'young' THEN 'k-2'
        WHEN 'older' THEN '9-12'
        ELSE '9-12'
      END
    )::"payload"."enum_users_grade_band_v2";

  ALTER TABLE "payload"."users" ALTER COLUMN "grade_band" SET DEFAULT '9-12';

  DROP TYPE "payload"."enum_users_grade_band";
  ALTER TYPE "payload"."enum_users_grade_band_v2" RENAME TO "enum_users_grade_band";
END
$$;

/*
  The versions shadow type. `Users` is `versions: false` (see the collection's
  own comment on why that matters for the erasure cascade), but the shadow enum
  was created before that was set and still exists. It is dropped rather than
  migrated: leaving a type whose only labels are the two values this migration
  removes is leaving a loaded gun for the next `push: true` run, which would
  reconcile against it.
*/
DROP TYPE IF EXISTS "payload"."enum__users_v_version_grade_band";
