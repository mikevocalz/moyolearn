import 'server-only';
// Public branding lookup for a district's sign-in page.
//
// THIS IS THE ONE SERVER READ THAT DOES NOT RUN INSIDE `protectedOperation`, and
// it is deliberate rather than an oversight. The block's rule exists so identity
// is never a parameter — but a login page has no session to take identity FROM,
// and a district's branded URL has to render before anyone has proved who they
// are. Wrapping this in `protectedOperation` would make the branded login work
// only for people who are already signed in.
//
// What that costs is bounded, and bounded on purpose: this returns a name, a
// logo and a palette token — the three things already printed on the district's
// own website and letterhead. It cannot reach a lead, a learner, a guardian or a
// count of anything, because it selects four columns of one row. An unknown slug
// resolves to null rather than an error, so probing it tells an attacker only
// whether a district they can already name is a customer.
// SOT: CLAUDE.md §The block (public-read carve-out) · docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: org branding public read login district logo unauthenticated service

/** The whole of what an unauthenticated caller may learn about a district. */
export interface OrgBranding {
  slug: string;
  name: string;
  logoUrl?: string;
  /** A wordmark letterboxes in a 4:3 box; a seal stays square. */
  logoAspect?: 'square' | 'wide';
  /** A palette token name, never a colour — see the Organizations collection. */
  brandAccent?: string;
  /** A curated Moyo surface token for the tenant shell. */
  brandTheme?: string;
}

/** Repository port — the caller provides the Payload adapter. */
export type LoadOrgBranding = (slug: string) => Promise<OrgBranding | null>;

/**
 * Resolves a district slug to its branding, or null when nothing matches.
 *
 * Null is a first-class answer, not a failure: `/login/not-a-district` must
 * render Moyo's own sign-in rather than an error page, because a typo'd link is
 * a likelier explanation than an attack and a broken login helps nobody.
 */
export async function orgBrandingFor(
  slug: string,
  loadOrgBranding: LoadOrgBranding,
): Promise<OrgBranding | null> {
  const trimmed = slug.trim().toLowerCase();
  // Cheap shape check before touching the database. Slugs are the tenant keys
  // this codebase writes; anything else is a probe and does not deserve a query.
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(trimmed)) return null;
  return loadOrgBranding(trimmed);
}
