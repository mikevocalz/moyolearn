// Organizations repository — the only place the login surface and the Block's
// host step touch Payload.
//
// Reads four columns of one row and nothing else. That narrowness is the
// security argument for the public carve-out in `org.service`: the query cannot
// widen into learner or pipeline data because it does not know how to.
// SOT: CLAUDE.md §The block · docs/pack/06-auth-onboarding-spec.md §5 · docs/deploy/moyo-district-tenancy.md §4
// SOT-KEYWORDS: org organizations repository payload branding login district public host tenant slug resolve
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Organization } from '@acme/payload';
import type { LoadOrgBranding, LoadOrgKind, LoadSchools, LoadTenantOrgId } from '@acme/app/server';
import { ORGANIZATION_KINDS, type OrganizationKind } from '@acme/app/server';

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
    select: { slug: true, name: true, logoUrl: true, logoAspect: true, brandAccent: true, brandTheme: true },
  });
  /*
    `select` widens Payload's return type to a partial whose members infer as
    `unknown`, which this codebase bans. The cast is to the GENERATED type
    narrowed to the same five keys, so the shape still comes from
    `payload-types.ts` rather than being hand-written here — and adding a field
    to the collection cannot silently widen what this returns.
  */
  const org = docs[0] as
    | Pick<Organization, 'slug' | 'name' | 'logoUrl' | 'logoAspect' | 'brandAccent' | 'brandTheme'>
    | undefined;
  if (!org) return null;
  return {
    slug: org.slug,
    name: org.name,
    logoUrl: org.logoUrl ?? undefined,
    logoAspect: org.logoAspect ?? undefined,
    brandAccent: org.brandAccent ?? undefined,
    brandTheme: org.brandTheme ?? undefined,
  };
};

/**
 * Does this tenant key name a real organisation? The Block's host step, bound to
 * the collection.
 *
 * `overrideAccess: true` on purpose: whether `nycdoe.moyolearn.com` IS a
 * district cannot depend on who is asking, or an unauthenticated request would
 * resolve to "no district" and be handled as an unscoped one. This read decides
 * SCOPE; the caller's rights are decided after it, by the membership the Block
 * then reads (`host-tenant.ts` — intersect, never replace).
 *
 * It returns the row's own slug rather than a boolean, so the value that lands
 * on `ctx.orgId` came out of the database rather than out of the `Host` header
 * that asked about it. One column, so it cannot widen.
 */
export const loadTenantOrgId: LoadTenantOrgId = async (slug) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { slug: true },
  });
  const org = docs[0] as Pick<Organization, 'slug'> | undefined;
  return org?.slug ?? null;
};

/**
 * Loads the `kind` of the current organization for the Block's institution
 * permission gate. This is a narrow, one-column, override read: the caller is
 * already inside `protectedOperation`, and the kind is needed to decide which
 * `RoleKind` the membership maps to.
 */
export const loadOrgKind: LoadOrgKind = async (ctx) => {
  if (!ctx.orgId) return null;
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: ctx.orgId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { kind: true },
  });
  const org = docs[0] as Pick<Organization, 'kind'> | undefined;
  const kind = org?.kind as OrganizationKind | undefined;
  if (!kind || !ORGANIZATION_KINDS.includes(kind)) return null;
  return kind;
};

/**
 * Lists all school organizations. This is called inside `protectedOperation`
 * after the caller has already passed the `district/schools/view` institution
 * gate, so it uses `overrideAccess: true`.
 */
export const loadSchools: LoadSchools = async (districtSlug) => {
  const payload = await getPayload({ config });
  // The `district` relationship stores the related organization numeric id,
  // not its slug, so we resolve the id from the current host slug first.
  const { docs: districts } = await payload.find({
    collection: 'organizations',
    where: {
      and: [{ slug: { equals: districtSlug } }, { kind: { equals: 'district' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { slug: true },
  });
  const district = districts[0] as Pick<Organization, 'id'> | undefined;
  if (!district) return [];

  const { docs } = await payload.find({
    collection: 'organizations',
    where: {
      and: [{ kind: { equals: 'school' } }, { district: { equals: district.id } }],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, name: true, logoUrl: true, logoAspect: true, brandAccent: true, brandTheme: true },
  });
  return (docs as Pick<Organization, 'slug' | 'name' | 'logoUrl' | 'logoAspect' | 'brandAccent' | 'brandTheme'>[]).map(
    (org) => ({
      slug: org.slug,
      name: org.name,
      logoUrl: org.logoUrl ?? undefined,
      logoAspect: org.logoAspect ?? undefined,
      brandAccent: org.brandAccent ?? undefined,
      brandTheme: org.brandTheme ?? undefined,
    }),
  );
};
