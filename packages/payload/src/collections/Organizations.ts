import type { CollectionConfig } from 'payload';

// The tenant. Doc 01 §(auth mapping) is explicit that this ONE object covers a
// tutoring company, a school and a district — "organization = tutoring company /
// school / district; teams = locations / departments" — so there is deliberately
// no District collection and no `districtId`. A district is an organization whose
// `kind` says so, and `orgId` stays the single tenant key every operational row
// carries (doc 12 §4).
//
// `slug` IS that key: it is the string in `Leads.orgId` and on `ctx.orgId`, not a
// separate display concern. Payload's numeric ids would make every tenant edge an
// integer nobody can read in a log line or a seed file.
//
// The pack specifies no fields for `Org` — doc 28 §2 names the object and stops.
// What is here is what a screen actually needs: doc 06 §5's org-create trio minus
// locations and services (both are their own planned collections, doc 01 §7.1),
// plus the two branding fields the co-branded login requires.
// SOT: docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping) §7.1 · docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/28-crm-spec.md §2
// SOT-KEYWORDS: organizations org tenant district school slug branding logo orgId collection

export const Organizations: CollectionConfig = {
  slug: 'organizations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'slug'],
    group: 'Operations',
  },
  access: { read: ({ req }) => Boolean(req.user) },
  // Same reasoning as Leads: an org's history is an audit event (doc 06 §6), not
  // a row-level diff, and versions double the schema for every collection.
  versions: false,
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      /*
        Unique because it is an identity, not a label. Two orgs sharing a slug
        would make `ctx.orgId` ambiguous, and an ambiguous tenant key is a
        cross-tenant read waiting to happen.
      */
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'The tenant key. This is the value rows carry as orgId.' },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'tutoring',
      options: ['tutoring', 'school', 'district'],
    },
    /*
      A URL rather than an upload relationship. `Media` is `upload: true` with no
      storage adapter, so it writes to local disk — which survives neither a
      serverless deploy nor a second instance. Remote image URLs are already how
      this codebase carries pictures (Avatar's `imageUri` through SolitoImage), and
      inventing a second mechanism for one field would break the rule that a thing
      has one way of being done.
    */
    { name: 'logoUrl', type: 'text' },
    {
      /*
        A TOKEN NAME, not a colour. Doc 08's palette is the accessible surface —
        contrast pairs are checked per token by `pnpm check:contrast` — so letting
        a district paste a hex would let it ship unreadable text under its own
        brand. Co-branding picks from the palette; it does not extend it.
      */
      name: 'brandAccent',
      type: 'select',
      defaultValue: 'ember',
      options: ['ember', 'gold', 'forest', 'sky', 'rose'],
    },
  ],
};
