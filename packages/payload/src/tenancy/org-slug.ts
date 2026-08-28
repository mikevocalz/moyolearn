// The write-time rule for `organizations.slug` — what a tenant key may be.
//
// It is a rule about a HOSTNAME, not about a label, because the slug becomes
// one: `slug: 'nycdoe'` is what makes `nycdoe.moyolearn.com` mean NYCDOE. Two
// consequences follow and both are enforced here rather than discovered later.
//
// RESERVED NAMES. A district that registers `www`, `app`, `api` or `admin`
// takes down a production surface — the record would either shadow one of
// Moyo's own hosts or be shadowed by it, and which one wins depends on DNS
// ordering nobody controls. The list is refused at validation so the state
// cannot exist, rather than handled at resolution so it merely cannot be read.
//
// SHAPE. RFC-1123's label rule. A slug carrying an underscore, a leading hyphen
// or 64+ characters is a slug no certificate authority will issue for and no
// resolver will accept, so it is a district that silently never works.
//
// Pure, and free of every Payload import, so the rule can be tested without
// standing up a CMS. It sits OUTSIDE `src/collections/` deliberately:
// `tooling/check-versions-off.mjs` reads every `.ts` in that directory as a
// collection that must declare `versions: false`, and that canary is worth more
// intact than this file is worth adjacent. The read-side twin — which host is a
// district at all — is
// `packages/auth/src/host-tenant.ts`; the two state the label shape twice
// because @acme/payload must not depend on the auth stack and @acme/auth must
// not depend on the CMS (doc 11 §3 — only repositories touch @acme/payload).
// Both are tested against the same cases.
// SOT: docs/deploy/moyo-district-tenancy.md §3 · docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping)
// SOT-KEYWORDS: org slug reserved validation tenant key hostname label district subdomain organizations

/**
 * Names no organisation may take. A superset of `NON_TENANT_HOSTS` in
 * `@acme/auth/host-tenant`: that list is the three hosts the app itself serves,
 * this one also covers the infrastructure subdomains a root domain grows —
 * `api`, `cdn`, `mail`, `status` — which would collide the day they exist.
 */
export const RESERVED_ORG_SLUGS: readonly string[] = [
  'www',
  'app',
  'admin',
  'api',
  'auth',
  'static',
  'assets',
  'cdn',
  'mail',
  'blog',
  'help',
  'support',
  'status',
  'docs',
  'dashboard',
];

/** RFC-1123's hostname label: 1–63 chars, no leading or trailing hyphen. */
export const ORG_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Payload's `validate` contract: `true` to accept, a message to refuse.
 *
 * Case is NOT normalised here. Silently lowercasing an editor's `NYCDOE` would
 * store a key that does not match what they typed, and every log line and seed
 * file that quotes the slug back would then disagree with the admin screen; a
 * refusal that says what to type is the honest version.
 */
export function validateOrgSlug(value: string | null | undefined): true | string {
  if (!value) return 'A tenant key is required.';
  if (RESERVED_ORG_SLUGS.includes(value)) return `"${value}" is reserved.`;
  if (!ORG_SLUG_PATTERN.test(value)) {
    return 'Lowercase letters, digits and hyphens only, 1–63 characters, and it cannot start or end with a hyphen.';
  }
  return true;
}
