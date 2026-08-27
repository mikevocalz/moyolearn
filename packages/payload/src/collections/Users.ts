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
      // Doc 07 §3 layer 1: the Safety Plane's band must be server-injected, so
      // it is stored on the learner rather than sent with a request. The two
      // values are the plane's register, not doc 08's four UI bands — this
      // field drives the crisis wording and the tutor's voice, and a policy
      // register with two settings is one a reviewer can hold in their head.
      name: 'gradeBand',
      type: 'select',
      options: ['young', 'older'],
      defaultValue: 'older',
      admin: { description: 'Drives tutor voice and the crisis register.' },
    },
  ],
};
