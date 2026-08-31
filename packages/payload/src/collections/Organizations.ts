import type { CollectionConfig } from 'payload';
import { validateOrgSlug } from '../tenancy/org-slug';

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
      /*
        It is also a HOSTNAME: this string is the label in
        `<slug>.moyolearn.com`, and `@acme/auth/host-tenant` reads it back off
        the request to decide which district a caller is in. So the rule that a
        slug must be a legal DNS label and must not be one of Moyo's own
        subdomains belongs at the write, where a bad key cannot come into
        existence — not at the read, where it would merely be unresolvable.
        The rule and its reasoning are in `org-slug.ts`.
      */
      validate: (value: string | null | undefined) => validateOrgSlug(value),
      admin: {
        description:
          'The tenant key. This is the value rows carry as orgId, and the subdomain the district signs in at.',
      },
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
        Real district logos are WORDMARKS, not squares — a seal beside a name, or
        a name alone. Cropping one to a square to match Moyo's tile is how a
        partner's brand ends up unreadable in its own product, so the lockup
        reserves a 4:3 box for those and letterboxes inside it rather than
        cropping. Per-district because the shape is a property of their logo, not
        a global guess.
      */
      name: 'logoAspect',
      type: 'select',
      defaultValue: 'square',
      options: [
        { label: 'Square (1:1)', value: 'square' },
        { label: 'Wordmark (4:3)', value: 'wide' },
      ],
    },
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
    {
      /*
        The tenant's Moyo shell theme. This is the pastel surface used for the
        app header, not the district's raw brand colour. Co-branding is curated:
        the value is one of the validated Moyo surface tokens so derived
        foregrounds always clear contrast. Admin/district shells fall back to
        `lavender`.
      */
      name: 'brandTheme',
      type: 'select',
      defaultValue: 'lavender',
      options: ['lavender', 'guava', 'mint', 'mango-pastel'],
    },
  ],
};
