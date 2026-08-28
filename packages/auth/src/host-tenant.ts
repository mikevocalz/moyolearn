// The request host, read as a tenant key — "which organisation is
// `nycdoe.moyolearn.com` asking about?"
//
// It lives in @acme/auth beside `membership.ts` because the answer is an
// IDENTITY fact. `ctx.orgId`, the `member` table's `organizationId` and
// `organizations.slug` are ONE string in this codebase (Organizations.ts says so
// in as many words), and this file is what derives that string from the request
// instead of from something the caller carries. Pure and I/O-free for the same
// reason the role catalogue is: the Block imports it, the Better Auth instance
// imports it, and neither may drag the other in.
//
// WHY THE HOST WINS OVER THE COOKIE OR THE CLAIM. A session cookie and a
// `user.orgId` claim both travel WITH the caller — the caller chooses them, and
// a user with access to several districts carries whichever one their account
// last defaulted to. The host does not travel with the caller: reaching
// `nycdoe.moyolearn.com` means resolving NYCDOE's DNS record and terminating
// against NYCDOE's certificate. So when the two disagree the host is the one
// that was not chosen by the party being authorised, and the alternative — an
// address bar vouching for a district the rows did not come from — is precisely
// the thing that must never appear in a FERPA audit.
//
// NOT A SECOND TENANT MODEL. There is no `Tenants` collection and no
// multi-tenant plugin: `Organizations` IS the tenant (`kind` distinguishes a
// tutoring company from a school from a district) and `MEMBERSHIP_ROLES` is the
// only membership concept. This file resolves a host to that existing key and
// stops.
// SOT: docs/deploy/moyo-district-tenancy.md §2 §4 §7 · docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping) · docs/pack/06-auth-onboarding-spec.md §1
// SOT-KEYWORDS: host tenant subdomain district slug root domain forwarded host non-tenant vercel preview login scoping authoritative

/**
 * The apex the district subdomains hang off. Overridable so `nycdoe.localhost`
 * works in dev (`NEXT_PUBLIC_ROOT_DOMAIN=localhost`) and so a staging apex is a
 * config change rather than a code change.
 *
 * Read on every call rather than captured at module load: this module is
 * imported by the Block, and a value frozen at import time would make the
 * enforcement depend on which request happened to load the module first.
 */
export const DEFAULT_ROOT_DOMAIN = 'moyolearn.com';

export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN).trim().toLowerCase();
}

/**
 * Subdomains that are Moyo's OWN surfaces, not districts.
 *
 * A different rule from the reserved-slug list on the Organizations collection
 * (`org-slug.ts`), which says what an organisation may not be NAMED. This says
 * which hosts we operate ourselves, and it is the smaller set on purpose: `api`
 * and `cdn` may never become districts, but nor do they serve the app, so they
 * never reach this function. The three that do are the learner/guardian app,
 * the super-admin surface, and the apex redirect.
 *
 * The two lists overlap by three strings and cannot be shared: @acme/auth must
 * not depend on the CMS package (doc 11 §3 — only repositories touch
 * @acme/payload) and @acme/payload must not depend on the auth stack. Both are
 * tested. Belt and braces either way: the collection stops an org called `app`
 * from existing, and this stops one that somehow did from being resolved.
 */
export const NON_TENANT_HOSTS: readonly string[] = ['app', 'admin', 'www'];

/**
 * RFC-1123's label shape, which is what a tenant key has to satisfy the moment
 * it becomes a hostname. Deliberately identical to `ORG_SLUG_PATTERN` in
 * `packages/payload/src/collections/org-slug.ts` — the same rule stated on the
 * read side because the two packages may not import each other (see
 * `NON_TENANT_HOSTS`). The write side is the one that keeps a bad key out of the
 * database; this one keeps a spoofed `Host` header out of a query.
 */
const TENANT_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * The client-facing host, from the two headers that can carry it.
 *
 * `x-forwarded-host` FIRST: Vercel terminates in front of the function, so
 * `host` there is the internal deployment host and the forwarded value is the
 * address the browser actually typed. Reading them the other way round would
 * scope every request to the deployment rather than to the district.
 *
 * Only the first entry of a comma-separated forwarded chain is honoured — the
 * first hop is the client-facing one, and accepting the last would let an
 * upstream append a district of its choosing.
 */
export function hostFromHeaderValues(
  forwardedHost: string | null | undefined,
  host: string | null | undefined,
): string | null {
  const raw = forwardedHost ?? host;
  if (!raw) return null;
  const first = raw.split(',')[0];
  if (!first) return null;
  // The port is not part of the identity: `nycdoe.localhost:3000` and
  // `nycdoe.localhost` are the same district.
  const withoutPort = first.trim().toLowerCase().split(':')[0];
  return withoutPort ? withoutPort : null;
}

export function hostFromHeaders(headers: Headers): string | null {
  return hostFromHeaderValues(headers.get('x-forwarded-host'), headers.get('host'));
}

/**
 * The tenant key a host names, or `null` for "this request has no tenant
 * context".
 *
 * Null is a first-class answer with exactly one meaning, and it is never "read
 * everything": the caller must treat it as "no district was named" and fall back
 * to what the SESSION already scoped, never to an unscoped query. Every one of
 * these is null —
 *   · a host that is not under the root domain at all (`moyo.vercel.app`, and so
 *     every preview deployment; `localhost`);
 *   · the apex itself (`moyolearn.com`);
 *   · a nested subdomain (`a.b.moyolearn.com`) — one label, or nothing, because
 *     a wildcard certificate covers one level and a second level is either a
 *     misconfiguration or someone probing;
 *   · Moyo's own surfaces (`app`, `admin`, `www`);
 *   · anything that is not a legal DNS label.
 */
export function tenantSlugFromHost(host: string | null): string | null {
  if (!host) return null;

  const root = rootDomain();
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  if (!label) return null;
  if (label.includes('.')) return null;
  if (NON_TENANT_HOSTS.includes(label)) return null;
  if (!TENANT_LABEL_PATTERN.test(label)) return null;

  return label;
}

/** `hostFromHeaders` composed with `tenantSlugFromHost`, for the common case. */
export function tenantSlugFromHeaders(headers: Headers): string | null {
  return tenantSlugFromHost(hostFromHeaders(headers));
}

/**
 * Doc §7's login scoping, as a predicate: may this account authenticate at this
 * host?
 *
 * A host with no tenant (`app.`, `admin.`, dev, a preview URL) permits everyone
 * — those surfaces are not districts and a guardian holds no org role by design.
 * A district host permits only an account that already holds a role in that
 * district, so a wrong login fails at the door rather than succeeding into an
 * empty admin screen.
 *
 * The CALLER must keep the refusal indistinguishable from a bad password. A
 * response that separated "wrong district" from "wrong password" would let
 * anyone enumerate which districts an email address belongs to, one guess at a
 * time.
 */
export function permitsLoginAtHost(
  tenantSlug: string | null,
  membershipRole: string | null | undefined,
): boolean {
  if (tenantSlug === null) return true;
  return typeof membershipRole === 'string' && membershipRole.length > 0;
}
