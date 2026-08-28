# Moyo — District Subdomain Tenancy (`apps/web`)

Companion to `moyo-vercel-deployment.md`. That doc covers DNS and build config; this is what makes the subdomain mean something.

| Rev | Change |
|---|---|
| 1 | Initial — host→tenant enforcement, cookie correction |
| 2 | Bare-subdomain URL shape (deployment §2); layout paths for both options |

---

## 1. The gap

`@payloadcms/plugin-multi-tenant` does **not** resolve the tenant from the request host. Its admin flow is a **tenant selector**: `useTenantSelection()` exposes `options`, `selectedTenantID`, and `setTenant({ id })`, and the selection persists in a `payload-tenant` cookie. Scoping comes from the user's associated tenants array via `getTenantAccess({ user })` — not from where the request arrived.

The host-based rewrite in Payload's docs is for **front-end content routes**, and it explicitly excludes admin:

```js
source: '/((?!admin|api)):path*'
```

So if you set up `nycdoe.moyolearn.com` and stop at DNS, this is what you get:

> A district admin loads `nycdoe.moyolearn.com`. Their `payload-tenant` cookie still says `chicago` from their last session. Payload serves Chicago's records. The URL bar says `nycdoe`.

That's worse than having no subdomain, because the address is now actively vouching for the wrong district. With student records under FERPA, an admin editing another district's data while the URL reassures them is exactly what you don't want surfacing in an audit.

**The subdomain is presentation. The host has to be made authoritative in access control, server-side, on every request.**

---

## 2. Cookie scoping — correction to deployment rev 2

Revision 2 of the deployment doc said to scope auth cookies to `.moyolearn.com` for cross-subdomain sessions. **Don't, for the admin surfaces.** A root-domain cookie is presented at every district host by definition — it hands the browser the exact capability you're trying to deny.

| Surface | Cookie domain | Rationale |
|---|---|---|
| `app.moyolearn.com` | host-scoped (no `domain` set) | learners/guardians/tutors |
| `<district>.moyolearn.com` | host-scoped | a session at `nycdoe` doesn't exist at `chicago` |
| `admin.moyolearn.com` | host-scoped | super admin isolated |

Nobody genuinely needs SSO across those boundaries — a district administrator and a guardian are different people with different sessions. Dropping the shared cookie is simpler *and* removes the whole class of cross-tenant replay. Host-scoping is defense in depth; §5 is the actual enforcement.

---

## 3. Tenants collection

```ts
// packages/payload-config/collections/Tenants.ts
import type { CollectionConfig } from 'payload'

const RESERVED = new Set([
  'www', 'app', 'admin', 'api', 'auth', 'static', 'assets', 'cdn',
  'mail', 'blog', 'help', 'support', 'status', 'docs', 'dashboard',
])

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'Slug is required'
        if (RESERVED.has(value)) return `"${value}" is reserved`
        if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(value)) {
          return 'Lowercase alphanumerics and hyphens; cannot start or end with a hyphen'
        }
        return true
      },
    },
    {
      name: 'domains',
      type: 'array',
      admin: { description: 'Hostnames that resolve to this district.' },
      fields: [{ name: 'domain', type: 'text', required: true, index: true }],
    },
  ],
}
```

The reserved list isn't optional — a district registering `www` or `app` takes down a production surface. It's also what keeps the bare-subdomain redirect in deployment §2.4 from firing on your own hosts.

---

## 4. Host → tenant resolution

```ts
// apps/web/lib/tenancy/resolve-host-tenant.ts
import type { PayloadRequest } from 'payload'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'moyolearn.com'
const NON_TENANT = new Set(['app', 'admin', 'www'])

export function hostFromRequest(req: PayloadRequest): string | null {
  // Vercel sits in front of the function; x-forwarded-host is the client-facing value
  const raw = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return raw ? raw.split(':')[0].toLowerCase() : null
}

export function slugFromHost(host: string | null): string | null {
  if (!host) return null
  if (!host.endsWith(`.${ROOT}`)) return null
  const label = host.slice(0, -(ROOT.length + 1))
  if (!label || label.includes('.')) return null   // no nested subdomains
  if (NON_TENANT.has(label)) return null
  return label
}

export async function resolveHostTenant(req: PayloadRequest) {
  const slug = slugFromHost(hostFromRequest(req))
  if (!slug) return null

  const { docs } = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,   // resolution must not depend on the caller
    pagination: false,
  })

  return docs[0] ?? null
}
```

`NON_TENANT` mirrors the negative lookahead in the deployment doc's redirect. Keep the two in sync — they're the same exclusion expressed twice, and drift between them is a live bug.

Preview deployments arrive on `*.vercel.app` and resolve to `null` — handle that as "no tenant context" rather than letting it fall through to an unscoped query.

---

## 5. Enforcement — host is authoritative

Every tenant-scoped collection ANDs the host tenant into its access constraint. The cookie is advisory; the host wins.

```ts
// apps/web/lib/tenancy/tenant-access.ts
import type { Access } from 'payload'
import { getTenantAccess } from '@payloadcms/plugin-multi-tenant/utilities'
import { resolveHostTenant } from './resolve-host-tenant'

/**
 * Intersects the plugin's user-tenant constraint with the tenant implied by
 * the request host. A user with access to several districts still only ever
 * reads the district whose subdomain they arrived on.
 */
export const hostScopedTenantAccess: Access = async ({ req }) => {
  if (!req.user) return false

  const userConstraint = getTenantAccess({ user: req.user })
  const hostTenant = await resolveHostTenant(req)

  // Super admins on admin.moyolearn.com: no host tenant, full user scope.
  if (!hostTenant) {
    return req.user.roles?.includes('super-admin') ? true : (userConstraint ?? false)
  }

  if (!userConstraint) return false

  return { and: [userConstraint, { tenant: { equals: hostTenant.id } }] }
}
```

Apply it to every tenant-scoped collection — `read`, `create`, `update`, `delete`. Missing one is the leak.

```ts
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  access: {
    read: hostScopedTenantAccess,
    create: hostScopedTenantAccess,
    update: hostScopedTenantAccess,
    delete: hostScopedTenantAccess,
  },
  // …
}
```

> Add a lint rule or a test that fails when a collection carrying a `tenant` field ships without all four. Worth enforcing mechanically rather than remembering.

---

## 6. Pinning the admin selector to the host

Enforcement above means a wrong selection returns nothing rather than someone else's data. But a selector showing `chicago` on `nycdoe.moyolearn.com` is still a confusing screen. Force the cookie to agree with the host on admin load, and hide the selector from anyone who isn't a super admin.

**File location depends on which URL shape you took** (deployment §2.3):

| Option | Path |
|---|---|
| 2 — redirect (default) | `apps/web/app/(payload)/admin/layout.tsx` |
| 3 — separate app | `apps/district/src/app/(payload)/layout.tsx` |

```ts
import { cookies, headers } from 'next/headers'

export default async function AdminLayout({ children }) {
  const host = (await headers()).get('x-forwarded-host') ?? ''
  const tenant = await lookupTenantBySlug(slugFromHost(host))

  if (tenant) {
    const jar = await cookies()
    if (jar.get('payload-tenant')?.value !== String(tenant.id)) {
      jar.set('payload-tenant', String(tenant.id), {
        path: '/', sameSite: 'lax', secure: true, httpOnly: false,
      })
    }
  }

  return children
}
```

In the plugin config, drop the selector for district staff:

```ts
multiTenantPlugin<Config>({
  userHasAccessToAllTenants: (user) => user.roles?.includes('super-admin') ?? false,
  // …
})
```

Super admins keep the dropdown at `admin.moyolearn.com`. District staff see one district, on one host, with no control implying otherwise.

---

## 7. Login scoping

Reject authentication at a host the user has no claim on, so a wrong login fails at the door rather than succeeding into an empty admin.

```ts
// packages/payload-config/collections/Users.ts
hooks: {
  beforeLogin: [
    async ({ req, user }) => {
      const hostTenant = await resolveHostTenant(req)
      if (!hostTenant) return user   // app. / admin. hosts

      const permitted = (user.tenants ?? []).some(
        (t) => String(t.tenant?.id ?? t.tenant) === String(hostTenant.id),
      )
      if (!permitted) {
        throw new Error('This account has no access to this district.')
      }
      return user
    },
  ],
}
```

Keep the message generic. A response that distinguishes "wrong district" from "wrong password" enumerates which districts an email belongs to.

---

## 8. Provisioning a district

Order matters — add the domain to Vercel *before* the DNS record so the certificate challenge fires the moment DNS lands.

**Interim (pilots, no nameserver delegation yet):**

1. Create the tenant in Payload — `slug: 'nycdoe'`, `domains: ['nycdoe.moyolearn.com']`
2. Add `nycdoe.moyolearn.com` to the Vercel project (`moyo-app`, or `moyo-district` under option 3)
3. IONOS → Domains & SSL → `moyolearn.com` → DNS → Add record:
   - Type `CNAME`, Host `nycdoe`, Value = the target on that project's domain card (per-project, e.g. `…vercel-dns-017.com.` — trailing dot included, copied exactly, not a generic value from a guide)
4. Wait for Valid Configuration; confirm the certificate issued
5. **Verify `nycdoe.moyolearn.com` reaches the portal** — 307 to `/admin` under option 2, serves at root under option 3
6. Run the §10 tests before handing over credentials

**After delegation:** with `*.moyolearn.com` on the project, steps 2–4 collapse into tenant creation alone. For programmatic provisioning before delegating, Vercel's Domains API can add a domain to a project — see https://vercel.com/docs/rest-api/reference/endpoints/domains for the current endpoint and version rather than pinning one from memory.

---

## 9. Local development

Host-based tenancy is invisible on `localhost`. Add to `/etc/hosts`:

```
127.0.0.1  nycdoe.localhost chicago.localhost admin.localhost app.localhost
```

Set `NEXT_PUBLIC_ROOT_DOMAIN=localhost` in dev so `ROOT` resolves correctly. Payload's own `localized-multitenant` example uses the same `/etc/hosts` pattern.

The bare-subdomain redirect's host regex is hardcoded to `moyolearn.com` — it won't fire locally. Either parameterise it or accept that dev hits `/admin` directly.

---

## 10. Tests that must pass before a district gets credentials

Integration tests, not a manual pass.

- [ ] User belonging **only** to `chicago` requests `nycdoe.moyolearn.com` → login rejected
- [ ] User belonging to **both** districts, logged in at `nycdoe`, lists enrollments → only NYCDOE rows
- [ ] Same user, cookie hand-edited to `payload-tenant=<chicago-id>`, still on the `nycdoe` host → NYCDOE rows or nothing; **never** Chicago rows
- [ ] Session established at `nycdoe.moyolearn.com`, cookie replayed at `chicago.moyolearn.com` → unauthenticated
- [ ] Direct REST hit `nycdoe.moyolearn.com/api/enrollments?where[tenant][equals]=<chicago-id>` → empty
- [ ] Super admin at `admin.moyolearn.com` → all districts, selector present
- [ ] District admin at their own host → selector absent
- [ ] `admin.moyolearn.com` and `app.moyolearn.com` → **not** treated as tenant hosts; no redirect fires
- [ ] A tenant named `www` / `app` / `admin` → rejected at validation
- [ ] Preview deployment on `*.vercel.app` → no tenant context, no unscoped reads

Test 3 is the one that fails if you rely on the plugin's cookie without §5. Test 8 is the one that fails if `NON_TENANT` and the redirect's lookahead drift apart.

---

## 11. References

- Multi-tenant plugin docs — https://payloadcms.com/docs/plugins/multi-tenant
- Plugin source — https://github.com/payloadcms/payload/tree/main/packages/plugin-multi-tenant
- `localized-multitenant` example (host + `/etc/hosts` pattern) — https://github.com/payloadcms/localized-multitenant
- Multi-tenant architecture writeup — https://payloadcms.com/posts/blog/how-to-build-a-multi-tenant-app-with-payload
- Tenant cookie / active-tenant state — https://www.buildwithmatija.com/blog/payload-cms-multi-tenant-state-management
- Admin Panel overview (root-level routes) — https://payloadcms.com/docs/admin/overview
- Custom Admin Panel Location — https://payloadcms.com/docs/admin/admin-panel-location
- Vercel multi-tenant quickstart — https://vercel.com/docs/platforms/multi-tenant-platforms/quickstart
- Vercel domains troubleshooting — https://vercel.com/docs/domains/troubleshooting
- Vercel Domains REST API — https://vercel.com/docs/rest-api/reference/endpoints/domains
- IONOS custom nameservers — https://www.ionos.com/help/domains/using-your-own-name-servers/using-your-own-name-servers-for-a-domain/
