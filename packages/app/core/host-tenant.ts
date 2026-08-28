// The Block's host step — the tenant the REQUEST names, resolved to a real
// organisation, so `protectedOperation` can scope to it instead of to whatever
// the caller's account happened to say.
//
// THE HOLE THIS CLOSES. `protectedOperation` built `ctx.orgId` from
// `user.orgId`: the org the account defaults to, not the org the address names.
// A user with access to several districts arriving at `nycdoe.moyolearn.com` was
// scoped to their default — so the URL vouched for NYCDOE while the rows came
// from somewhere else, over student records under FERPA. The host is the only
// part of the request the caller cannot choose while still reaching the
// district's DNS record and certificate, so when the two disagree the host wins.
//
// INTERSECT, NEVER REPLACE. Winning is not the same as granting. A host org is
// applied only after the caller's own membership in it has been read, so the
// address can NARROW what a session may see and can never widen it: arriving at
// `chicago.moyolearn.com` gets a NYCDOE-only account a refusal, not Chicago's
// pipeline. `LoadMembershipRole` — the port the role gate already uses — is what
// answers that, because a second way to ask "is this person staff here" is a
// second answer waiting to disagree.
//
// FAIL CLOSED, THREE WAYS. `none` (no district in the host) is the only outcome
// that preserves today's behaviour; a tenant-shaped host that matches no
// organisation, and one that arrives with no reader wired, both refuse. The
// alternative — falling back to the session's own scope when resolution fails —
// is a lookup outage quietly becoming a scoping change.
//
// Pure and I/O-free like the gates beside it: the database read is a port, and
// the only real implementation is `loadTenantOrgId` in apps/web (CLAUDE.md ·
// only repositories touch @acme/payload).
// SOT: docs/deploy/moyo-district-tenancy.md §4 §5 §10 · docs/pack/11-architectural-guardrails.md §3 · CLAUDE.md §The block
// SOT-KEYWORDS: host tenant block org scoping district subdomain authoritative intersect fail closed protected operation resolver registry

import { MEMBERSHIP_ROLES } from '@acme/auth/membership';
import { hostFromHeaders, tenantSlugFromHost } from '@acme/auth/host-tenant';
import { MembershipDenied } from './membership-gate.ts';

/**
 * How the Block learns whether a tenant key names a real organisation.
 *
 * A port for the same reason `LoadMembershipRole` is one: the answer lives in
 * the `organizations` collection, this file must stay runnable without a CMS,
 * and only a repository is allowed to reach Payload. It returns the CANONICAL
 * slug rather than a boolean so the value written onto `ctx.orgId` comes from
 * the row, never from the header that asked about it.
 */
export type LoadTenantOrgId = (slug: string) => Promise<string | null>;

/**
 * What the request host says about tenancy. Three outcomes, not a nullable
 * string, because "no district was named" and "a district was named and does
 * not exist" call for opposite behaviour and an `orgId | null` cannot tell them
 * apart (CLAUDE.md · invalid combinations unrepresentable).
 */
export type HostTenant =
  /** `app.` / `admin.` / the apex / dev / a preview URL: scope by session, as before. */
  | { readonly kind: 'none' }
  /** A district host that resolved. Authoritative, subject to membership. */
  | { readonly kind: 'org'; readonly orgId: string }
  /** A district-shaped host that resolved to nothing. Refuse. */
  | { readonly kind: 'unresolved'; readonly slug: string };

export const NO_HOST_TENANT: HostTenant = { kind: 'none' };

/**
 * The refusal, and deliberately a `MembershipDenied`.
 *
 * It is not a new error taxonomy because it is not a new fact: "you hold no role
 * in the organisation this address names" is the membership gate's sentence,
 * said about the org the host chose rather than the org the session chose. Every
 * route that already maps a refusal to 403 therefore maps this one, with no call
 * site changed, and no refusal can arrive dressed as a 402 upsell.
 *
 * The message is INHERITED on purpose. A message that named the district would
 * let an attacker walk the subdomains and learn which ones an account belongs
 * to; the generic sentence says only "not here".
 */
export class HostTenantDenied extends MembershipDenied {
  /** The tenant key the request named. For the audit line, never for a response body. */
  readonly hostSlug: string;

  constructor(hostSlug: string) {
    super(MEMBERSHIP_ROLES, null);
    this.name = 'HostTenantDenied';
    this.hostSlug = hostSlug;
  }
}

/*
  The production reader, registered once at process start rather than threaded
  through every route — the same trade `setOperationSink` makes in telemetry.ts,
  and for the same reason: a port that fourteen call sites each have to remember
  to wire is a port thirteen of them will wire and one will not, and that one is
  the leak. `apps/web/lib/tenancy.wiring.ts` installs it from `instrumentation.ts`.

  A process that never registers one does not fall back to unscoped behaviour —
  `resolveHostTenant` returns `unresolved` for any district host, so a missed
  registration is 403s on district subdomains (loud, and confined to them) rather
  than cross-tenant reads (silent, and everywhere).
*/
let tenantOrgReader: LoadTenantOrgId | null = null;

export function setTenantOrgReader(next: LoadTenantOrgId | null): void {
  tenantOrgReader = next;
}

/**
 * Resolves the request host to an organisation.
 *
 * The lookup runs ONLY after the host has been parsed to a district-shaped
 * label. That ordering is the "no unscoped read" requirement made structural:
 * `admin.`, `app.`, `localhost` and every `*.vercel.app` preview return before
 * the port is ever called, so there is no query for them to widen.
 *
 * A reader that throws resolves to `unresolved`, not to `none` — a database that
 * cannot answer must read as "you may not be here", exactly as
 * `readMembershipRole` reads a failure as "not staff".
 */
export async function resolveHostTenant(
  headers: Headers,
  loadTenantOrgId: LoadTenantOrgId | null = tenantOrgReader,
): Promise<HostTenant> {
  const slug = tenantSlugFromHost(hostFromHeaders(headers));
  if (slug === null) return NO_HOST_TENANT;
  if (!loadTenantOrgId) return { kind: 'unresolved', slug };

  try {
    const orgId = await loadTenantOrgId(slug);
    return orgId === null ? { kind: 'unresolved', slug } : { kind: 'org', orgId };
  } catch {
    return { kind: 'unresolved', slug };
  }
}
