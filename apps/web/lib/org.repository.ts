// Organizations repository — the only place the login surface touches Payload.
//
// Reads four columns of one row and nothing else. That narrowness is the
// security argument for the public carve-out in `org.service`: the query cannot
// widen into learner or pipeline data because it does not know how to.
// SOT: CLAUDE.md §The block · docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: org organizations repository payload branding login district public
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Organization } from '@acme/payload';
import type { LoadOrgBranding } from '@acme/app/server';

export const loadOrgBranding: LoadOrgBranding = async (slug) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: slug } },
    limit: 1,
    /*
      An explicit allow-list, not a convenience. `select` is what keeps a future
      field — a billing contact, an internal note — from being handed to an
      unauthenticated page just because somebody added it to the collection.
    */
    select: { slug: true, name: true, logoUrl: true, logoAspect: true, brandAccent: true },
  });
  /*
    `select` widens Payload's return type to a partial whose members infer as
    `unknown`, which this codebase bans. The cast is to the GENERATED type
    narrowed to the same four keys, so the shape still comes from
    `payload-types.ts` rather than being hand-written here — and adding a field
    to the collection cannot silently widen what this returns.
  */
  const org = docs[0] as
    | Pick<Organization, 'slug' | 'name' | 'logoUrl' | 'logoAspect' | 'brandAccent'>
    | undefined;
  if (!org) return null;
  return {
    slug: org.slug,
    name: org.name,
    logoUrl: org.logoUrl ?? undefined,
    logoAspect: org.logoAspect ?? undefined,
    brandAccent: org.brandAccent ?? undefined,
  };
};
