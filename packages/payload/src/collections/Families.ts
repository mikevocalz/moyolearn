import type { CollectionConfig } from 'payload';

// The CRM household object (doc 28 §2, ADR-109). One row per family per org —
// the record behind the /families surface, which shipped as a name-text
// derivation over leads until this collection existed.
//
// THE WALL is structural here exactly as it is on Leads: a family carries
// relationship and billing context and NO learning content. `contacts` is
// doc 28 §2's GuardianContact as business contact data — the household's comms
// identity (name, relationship, email, phone), which the CRM side is allowed
// to hold; the consent check that scopes actually SENDING to a contact
// (doc 14 T4) belongs to the unbuilt Activity/automation work, not this row.
// `learnerRefs` are text POINTERS to the identity docs, never a Payload
// relationship — the ops schema cannot join its way into learner data.
//
// `name` is unique per org because it is the upsert key: lead creation upserts
// the household by (orgId, name) service-side, and the backfill inserts with
// ON CONFLICT on the same pair. The uniqueness is what makes both idempotent.
//
// `orgId` is the tenant boundary. It is written from `ctx` at the service layer
// and never accepted from client input (CLAUDE.md · The block).
// SOT: docs/pack/28-crm-spec.md §2 · docs/decisions/adr-109-family-household-object.md
// SOT-KEYWORDS: families crm household guardian contact learner ref pointer
//               tenant org ops collection wall upsert

export const Families: CollectionConfig = {
  slug: 'families',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'orgId'],
    group: 'Operations',
  },
  access: { read: ({ req }) => Boolean(req.user) },
  /*
    No Payload version table, for the Leads reason: this canary defaults
    versions ON, and a household's history is doc 28 §2's Activity timeline
    (unbuilt), not a row-level diff nobody in ops will ever open.
  */
  versions: false,
  indexes: [
    // The upsert key — and what keeps the backfill's INSERT idempotent.
    { fields: ['orgId', 'name'], unique: true },
  ],
  fields: [
    { name: 'orgId', type: 'text', required: true, index: true },
    // The household label the pipeline's `family` text becomes a pointer to.
    { name: 'name', type: 'text', required: true },
    {
      // Doc 28 §2's GuardianContact, as rows of business contact data.
      name: 'contacts',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'relationship',
          type: 'text',
          required: true,
          admin: { description: 'The contact’s relationship to the household — "Mother", "Guardian", …' },
        },
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
      ],
    },
    {
      /*
        Pointers, never a relationship — the same decision Leads.ts makes for
        its `learnerRef`, one level up: doc 28 §2 makes LearnerRef a reference
        to the identity docs precisely so the CRM cannot traverse into learner
        data, and a Payload `relationship` would hand every ops query a
        populated join.
      */
      name: 'learnerRefs',
      type: 'array',
      fields: [{ name: 'ref', type: 'text', required: true }],
    },
  ],
};
