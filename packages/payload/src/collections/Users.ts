import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  /*
    VERSIONS OFF — this canary defaults them ON (see Leads.ts), and for a
    collection holding learner content that default silently breaks the erasure
    cascade promised by docs 19 and 24.

    Payload mirrors every write into `_<table>_v`, and the retention sweep
    targets `expires_at` on the MAIN table only. So a transcript survives its own
    deletion in the shadow table: "delete my child's data" does not delete it.
    Disk growth is the symptom; the broken guarantee is the defect, and it is the
    one a district's counsel asks about.

    Measured before turning it off: 1,294 shadow rows across the schema, with
    `_student_model_facts_v_texts` holding 1,119 against 49 live — a 23x copy of
    derived learner facts that nothing was ever going to sweep.

    Versions are an editorial feature: draft/publish, revert, who-changed-what.
    None of that applies to an append-only record of a child's session.
  */
  versions: false,
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [
    { name: 'name', type: 'text' },
    {
      /*
        Doc 07 §3 layer 1: the band must be server-injected, so it is stored on
        the learner rather than sent with a request.

        FOUR VALUES SINCE DOC 31, and the reason is the failure that doc was
        written about: the tutor answered a first grader "like an Ivy League
        adult". Two values could not tell a first grader from a fifth grader, so
        both got one prompt, and this field's old comment argued for exactly
        that — "a policy register with two settings is one a reviewer can hold
        in their head". True of a policy register, and this was never only one:
        it also picks the tutor's voice, and doc 31 §2.1 splits elementary for
        voice precisely because a K-2 reply and a 3-5 reply are different
        replies.

        The two-value policy register did not go away; it stopped being stored.
        `planeRegisterFor` derives it at the coaching boundary, so the crisis
        wording still has its two settings and there is still one column.

        Migration: `packages/payload/migrations/users_voice_bands.sql`. It maps
        `young` to `k-2` and `older` to `9-12` rather than dropping them —
        `asVoiceBand` reads the old labels the same way, so a row this codebase
        has not seen yet is a band rather than a fallback.
      */
      name: 'gradeBand',
      type: 'select',
      options: ['k-2', '3-5', '6-8', '9-12'],
      defaultValue: '9-12',
      admin: { description: 'Doc 31 §2 voice band. Drives tutor voice and the crisis register.' },
    },
  ],
};
