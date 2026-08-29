# Moyo Learn — Vercel Deployment Configuration

**Registrar:** IONOS · **Host:** Vercel · **Repo:** `mikevocalz/moyolearn` (private)

| Rev | Change |
|---|---|
| 1 | Initial — assumed three projects incl. a separate `apps/admin` |
| 2 | Corrected: no `apps/admin`; super admin lives in `apps/web-vite` |
| 3 | District URL shape — bare subdomain preferred; redirect wired as default, separate-app variant specced |
| 4 | Corrected again: the super admin is `apps/admin-vite` on its own project `moyo-admin`. Rev 2 was right about there being no `apps/admin`; it was wrong that co-hosting was free. §2.5's three-project shape, applied to the super admin instead of to districts — measurement and reversal in `docs/site/adr-004-admin-app-split.md` |

Companion: `moyo-district-tenancy.md` (host→tenant binding and access enforcement).

---

## 1. Topology

Three Vercel Projects against one repo, each with its own Root Directory.

| Project | Root Directory | Framework | Serves |
|---|---|---|---|
| `moyo-www` | `apps/web-vite` | TanStack Start (Vite + Nitro) | `moyolearn.com` → 308 → `www.moyolearn.com` (marketing) |
| `moyo-admin` | `apps/admin-vite` | TanStack Start (Vite + Nitro) | `admin.moyolearn.com` (company-wide super admin, Payload) |
| `moyo-app` | `apps/web` | Next.js | `app.moyolearn.com` (learning app)<br>`*.moyolearn.com` (district portals) |

Each domain lands on exactly one project. `admin.moyolearn.com` is the only one that moved: it was assigned to `moyo-www` in revs 1–3.

**Why the super admin is its own project.** Rev 2 removed `apps/admin` and put the panel inside `apps/web-vite`, on the reasoning that two surfaces on one Nitro server cost nothing but a `Cache-Control` header. They cost 89.8 kB gzipped on the marketing critical path. `@payloadcms/tanstack-start` requires `tanstackStart({ rsc: { enabled: true } })`, which builds **one** client entry for the whole app: `@vitejs/plugin-rsc`'s browser runtime shipped to every marketing visitor, and initial JS on `/` went 155.8 → 245.6 kB gz. None of it was Payload code — the panel itself code-splits correctly — and there is no per-route opt-out. Splitting the apps returned `/` to 155.8 kB gz. The measurement, both directions, is `docs/site/adr-004-admin-app-split.md`; how the mount itself was built is `adr-003`.

This is §2.5's three-project shape, taken for the super admin rather than for districts. It does **not** change the district URL decision in §2 — that is still option 2 (redirect), and a `moyo-district` project would be a **fourth**.

The shared-config rules in §5.2 are unchanged and now bind three apps instead of two: one `buildConfig()` in `packages/payload`, `apps/web` owns migrations, `PAYLOAD_SECRET` identical everywhere.

---

## 2. District portal URL shape

Preference on record: districts reach their portal at **`nycdoe.moyolearn.com`**, not `nycdoe.moyolearn.com/admin`.

### 2.1 What Payload allows

Payload supports mounting the admin panel at the application root — their docs state you can change root-level routes "such as to mount the Admin Panel at the root of your application." It also states the constraint: changing root-level routes **requires a matching change to project structure**.

### 2.2 Why bare root forces a third project

`routes.admin` is a single static value for the whole Payload config. Set it to `/` and `app/(payload)/[[...segments]]/page.tsx` sits at the root of that Next build — the same route the learner app's root `page.tsx` claims. Next won't resolve two route groups owning `/`.

**Bare-root district admin and `app.moyolearn.com` cannot coexist in one Next app.**

### 2.3 The three shapes

| | URL | Cost | Status |
|---|---|---|---|
| 1. Suffix | `nycdoe.moyolearn.com/admin` | none | superseded |
| **2. Redirect** | type bare, land on `/admin` | ~5 lines | **default — wired below** |
| 3. Separate app | bare throughout | third Next app + third Vercel project | specced in §2.5 |

### 2.4 Option 2 — redirect (default)

Districts type, print, and email the bare subdomain. `/admin` appears once they're inside.

```ts
// apps/web/next.config.ts
async redirects() {
  return [{
    source: '/',
    has: [{
      type: 'host',
      value: '(?<tenant>(?!app$|www$|admin$)[^.]+)\\.moyolearn\\.com',
    }],
    destination: '/admin',
    permanent: false,   // 307 — keeps the decision reversible
  }]
}
```

`permanent: false` matters. A 308 is cached hard by browsers; if you move to option 3 later, every district admin who visited once keeps getting redirected to a path that no longer exists until they clear cache.

If the host lookahead proves brittle across Next versions, move the same logic to `middleware.ts` where it's explicit rather than regex-encoded.

Only `/` needs redirecting — Payload generates `/admin/…` links itself, so deeper paths already resolve. A bookmark to `nycdoe.moyolearn.com/collections/x` will 404, but Payload never emits that URL.

### 2.5 Option 3 — separate app (bare root throughout)

Take this if the bare subdomain is a positioning decision — districts seeing only their own domain — rather than a convenience one.

**Revised topology:**

| Project | Root Directory | Serves |
|---|---|---|
| `moyo-www` | `apps/web-vite` | marketing |
| `moyo-admin` | `apps/admin-vite` | `admin.moyolearn.com` — super admin |
| `moyo-app` | `apps/web` | learner app. Payload **API only**, no admin UI |
| `moyo-district` | `apps/district` | `*.moyolearn.com` — Payload admin at `/` |

This would be the **fourth** project, not the third: §1 already spends the third on the super admin.

**Structure** — contents of `admin/` move up one level:

```
apps/district/src/app/(payload)/
├── [[...segments]]/        ← moved up out of admin/
│   ├── page.tsx
│   └── not-found.tsx
├── api/
├── layout.tsx
├── custom.scss
└── importMap.js
```

**Config:**

```ts
routes: {
  admin: '/',
  api: '/api',
  graphQL: '/api/graphql',
  graphQLPlayground: '/api/graphql-playground',
},
admin: {
  importMap: { baseDir: path.resolve(dirname, 'src/app/(payload)') },
},
```

Then fix the importMap import in `layout.tsx` (`./admin/importMap.js` → `./importMap.js`) and immediately run:

```bash
pnpm payload generate:importmap
pnpm tsc --noEmit
```

Payload's docs warn that IDE auto-updates miss stale references after this move, and the importmap generator has a history of hardcoding the `admin` segment (payload#7803, payload#8947). Verify generation succeeds before building anything on top.

**Knock-ons:** `apps/web` keeps `withPayload` and `(payload)/api` for the learner app and mobile client, but drops `(payload)/admin`. Both apps now expose a Payload API — tenant scoping in `moyo-district-tenancy.md` §5 applies to both. Migrations stay owned by `apps/web` (§5.2).

---

## 3. Build configuration

### 3.1 `apps/web-vite` — marketing

TanStack Start deploys through the Nitro Vite plugin, which compiles server code into Vercel Functions on Fluid compute.

```ts
// apps/web-vite/vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
})
```

Leave `nitro()` unconfigured — it detects Vercel and emits Build Output API v3 to `.vercel/output`. Do **not** set `outputDirectory` in `vercel.json`; overriding it breaks the Build Output pickup and produces the classic "home page loads, every other route 404s."

```json
// apps/web-vite/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "moyolearn.com" }],
      "destination": "https://www.moyolearn.com/$1",
      "permanent": true
    }
  ]
}
```

Set the Framework Preset in the dashboard (Settings → General → Framework Preset → *TanStack Start*). Auto-detection is known to fail inside monorepos. No `"framework"` slug is hardcoded here — read the exact string off your project settings before committing one.

### 3.2 `apps/admin-vite` — super admin

The same stack, one surface, opposite caching. Marketing wants aggressive edge caching; the admin must never be cached and never prerender. Both are explicit, not default:

```ts
// apps/admin-vite/src/routes/_payload.tsx — the pathless layout, so /payload-api inherits it
export const Route = createFileRoute('/_payload')({
  ...payloadLayoutRoute({ load: getLayoutDataFn, serverFunction: serverFunctionHandler }),
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
})
```

```ts
// apps/admin-vite/vite.config.ts — the other half. Headers only matter once a
// request reaches the server, and a prerendered file never lets it.
tanstackStart({ ...pluginOptions.tanstackStart, prerender: { enabled: false } })
```

`find apps/admin-vite/dist/client -name '*.html'` must print nothing.

#### 3.2.1 Build it on Vercel, not locally

`vercel deploy --prebuilt` works but buys nothing and costs the thing you need
most when something breaks: **a `--prebuilt` deploy produces no build log on
Vercel**, and a server crash inside it logs as `λ GET /admin 500 (no message)`
with the error masked by production error handling. There is nothing to read.

`apps/admin-vite/vercel.json` carries the two commands:

```json
{
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter admin-vite... build",
  "framework": null
}
```

Both `cd ../..` because pnpm must resolve the workspace from the repo root — the
lockfile, the catalog and every `@acme/*` dependency live there, not in the app.
The `...` suffix on the filter is load-bearing: it means *this package and
everything it depends on*, so `@acme/payload` and `@acme/theme` build first.

Three settings remain in the dashboard, because `vercel.json` cannot express
them (Project → Settings → Build & Deployment):

| Setting | Value |
|---|---|
| Root Directory | `apps/admin-vite` |
| Include source files outside of the Root Directory | **on** |
| Skew Protection | on (optional, but the admin is long-lived in a tab) |

Without the second, `cd ../..` lands in an empty directory and install fails
immediately.

#### 3.2.2 `sharp` needs its Linux binaries installed, not copied

The admin's 500 was `sharp`, and it took three wrong diagnoses to find because
every cheap check said `sharp` was fine:

```
Could not load the "sharp" module using the linux-x64 runtime
```

`sharp` is a native module. A `--prebuilt` deploy uploads whatever
`node_modules` a **macOS** laptop produced, and pnpm installs only the current
platform's optional dependencies — so the bundle carried
`@img/sharp-darwin-arm64` and nothing a Linux lambda can load. Payload imports
`sharp` at config level (`payload.config.ts`), so **every** database-touching
route dies while `/` still redirects normally, which is what made it look like a
database fault.

Hand-copying the Linux binaries in appears to work and does not survive: the
next build wipes them, silently, and the deploy goes back to failing. Let pnpm
own it instead — root `package.json`:

```jsonc
"pnpm": {
  "supportedArchitectures": {
    "cpu": ["current", "x64"],
    "os":  ["current", "linux"]
  }
}
```

`pnpm install` then fetches every Linux variant alongside the native one, and
they land in the function bundle by the normal trace. Verify both halves — the
addon **and** its shared library, since the addon alone still will not load:

```bash
find apps/admin-vite/.vercel/output/functions/__server.func/node_modules/@img \
  \( -name '*.node' -o -name 'libvips-cpp.so*' \) | grep linux
```

Building on Vercel (§3.2.1) avoids this entirely, because install runs on Linux.
`supportedArchitectures` is what makes a laptop `--prebuilt` deploy correct too.

**Nitro picks its output format from `VERCEL=1`**, which Vercel sets during its
own builds. Run `pnpm --filter admin-vite build` on a laptop and you get
`.output/`; run it with `VERCEL=1` and you get `.vercel/output/` in the Build
Output API v3 layout. This is why `turbo.json` must list **all three** of
`dist/**`, `.output/**` and `.vercel/output/**` as build outputs for both vite
apps. It previously listed only `dist/**`, which meant a Turborepo cache hit
restored no deployable artifact at all — the build would "succeed" and ship
whatever stale files happened to be on disk.

Four consequences, now that this is its own project:

1. **`moyo-admin` holds production secrets** — `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`. Scope Production-only. `moyo-www` no longer needs any of them, which is the security half of the split: a marketing preview deployment cannot carry live database credentials because the marketing app has no code that reads them.
2. **The Payload REST + GraphQL API moved with the panel.** `/payload-api/*` answers on `admin.moyolearn.com`, not on `www.moyolearn.com`. The public marketing origin is back to serving static files.
3. **Strict CSP on `admin.moyolearn.com`**; auth cookie `HttpOnly; Secure; SameSite=Lax`, host-scoped per §5.3.
4. **This app defines nothing and migrates nothing** (§5.2). No collections, no schema, no `payload migrate` in its build command.

Pin `nitro`, `@tanstack/react-start`, `@vitejs/plugin-rsc` and `@payloadcms/tanstack-start` to **exact** versions. Both TanStack apps ride the Nitro Vite plugin, which is under active development — a lockfile refresh the week of the demo is an avoidable lost day. `@payloadcms/tanstack-start`'s `payload` peer is an exact pin rather than a range, so those two versions move together or `pnpm install` fails.

### 3.3 `apps/web` — learner app + district portals

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@moyo/ui', '@moyo/payload-config'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  async redirects() {
    return [
      {
        // §2.4 — bare district subdomain lands on the portal
        source: '/',
        has: [{
          type: 'host',
          value: '(?<tenant>(?!app$|www$|admin$)[^.]+)\\.moyolearn\\.com',
        }],
        destination: '/admin',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        // district content surfaces resolve by host; admin + api stay put
        source: '/((?!admin|api|_next)):path*',
        destination: '/:tenant/:path*',
        has: [{ type: 'host', value: '(?<tenant>[^.]+)\\.moyolearn\\.com' }],
      },
    ]
  },
}

export default withPayload(config)
```

```json
// apps/web/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm payload migrate && pnpm build",
  "functions": {
    "app/(payload)/**": { "maxDuration": 60 }
  }
}
```

Route tree:

```
apps/web/app/
├── (payload)/admin/[[...segments]]/   # Payload panel — host-scoped tenant
├── [tenant]/                          # district content, via host rewrite
└── (app)/                             # learner/guardian/tutor surfaces
```

### 3.4 Root

```json
// package.json (root)
{ "engines": { "node": "22.x" } }
```

Payload requires Node 20.9.0+. Pin at root so both projects agree.

---

## 4. IONOS DNS

Wildcard subdomains are load-bearing — `*.moyolearn.com` is how districts get their URLs. **A wildcard cannot be served by an A record.** Vercel runs the ACME challenge on every renewal, which requires nameserver delegation. Not optional.

**IONOS → Domains & SSL → `moyolearn.com` → Nameserver → Use custom nameservers:**

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**Before saving:** delegation moves the entire zone, MX included. Screenshot every record first and recreate MX/SPF/DKIM/DMARC in Vercel DNS immediately — mail going dark after a domain moves to Vercel is common enough that Vercel keeps a KB article on it.

| Domain | Project (default) | Project (option 3) |
|---|---|---|
| `moyolearn.com` | `moyo-www` (308 → www) | `moyo-www` |
| `www.moyolearn.com` | `moyo-www` | `moyo-www` |
| `admin.moyolearn.com` | `moyo-admin` | `moyo-admin` |
| `app.moyolearn.com` | `moyo-app` | `moyo-app` |
| `*.moyolearn.com` | `moyo-app` | `moyo-district` |

⚠️ **Verify, don't assume:** `admin.` and `app.` are explicit assignments falling inside the wildcard. Exact matches should take precedence, but confirm in the dashboard after assignment. Keep `admin` and `app` on the reserved-slug list regardless.

Lower TTLs to ≤3600 at IONOS before cutover so rollback is fast.

### Interim path — per-district CNAME, no delegation

For pilot districts before the nameserver move:

```
Type:  CNAME
Host:  nycdoe
Value: <project-specific>.vercel-dns-0NN.com.
```

Each Vercel project has its own CNAME target — copy it from the project's domain card, trailing dot included, not from a guide. Add `nycdoe.moyolearn.com` as a domain on the project **first**, then create the record, so the certificate challenge fires as soon as DNS lands.

---

## 5. Payload

### 5.1 Storage

Vercel's runtime filesystem is read-only, so local upload storage isn't available.

```ts
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

plugins: [
  vercelBlobStorage({
    enabled: true,
    collections: { media: true },
    token: process.env.BLOB_READ_WRITE_TOKEN,
    clientUploads: true, // required
  }),
]
```

`clientUploads: true` isn't optional. **Server uploads through Vercel cap at 4.5 MB.** A phone-camera homework photo clears that routinely — without client uploads the capture flow passes locally and fails in production. The adapter sets `disableLocalStorage: true` on those collections automatically.

### 5.2 Multiple Payload instances, one database

Payload derives schema from config, so multiple configs on one database is drift waiting to happen.

1. **One shared config package.** `packages/payload` (`@acme/payload`) exports the single `buildConfig()`. Every app imports it; none define collections locally. Three consumers now: `apps/web` (Next, via `withPayload`), `apps/admin-vite` (TanStack Start, via the `@payload-config` alias) and any future district app.
2. **`apps/web` owns migrations.** It runs `payload migrate` in its build command. No other app does.
3. **`push: false` in production** everywhere. Dev push against a shared database rewrites tables under the other apps.
4. **`PAYLOAD_SECRET` identical across all projects.** It signs JWTs and encrypts stored field values — a mismatch means one app can't decrypt what another wrote.

### 5.3 Cookie scoping

**Host-scoped, not root-scoped.** A `.moyolearn.com` cookie is presented at every district host by definition — see `moyo-district-tenancy.md` §2.

| Surface | Cookie domain |
|---|---|
| `app.moyolearn.com` | host-scoped |
| `<district>.moyolearn.com` | host-scoped |
| `admin.moyolearn.com` | host-scoped |

Payload `cors` / `csrf` still need every origin listed, including a wildcard pattern for district hosts. Preview deployments land on `*.vercel.app` — add `VERCEL_URL` conditionally outside production or auth breaks on every preview.

---

## 6. Environment variables

| Variable | `moyo-www` | `moyo-admin` | `moyo-app` | `moyo-district`¹ | Notes |
|---|:--:|:--:|:--:|:--:|---|
| `DATABASE_URL` | | ● | ● | ● | Pooled |
| `DATABASE_URL_UNPOOLED` | | | ● | | Migrations only |
| `PAYLOAD_SECRET` | | ● | ● | ● | **Must match** |
| `BLOB_READ_WRITE_TOKEN` | | ● | ● | ● | Auto-injected by Vercel Blob |
| `NEXT_PUBLIC_SITE_URL` | | ● | | | Payload `serverURL` + its only `cors`/`csrf` origin. `https://admin.moyolearn.com` |
| `BUNNY_STORAGE_ACCESS_KEY` | | ● | ● | ● | Admin-panel uploads (§5.1) |
| `BETTER_AUTH_SECRET` | ● | | ● | ● | Must match |
| `BETTER_AUTH_URL` | ● | | ● | ● | Per-origin |
| `STRIPE_SECRET_KEY` | ● | | ● | | |
| `STRIPE_WEBHOOK_SECRET` | | | ● | | Webhook lands on `app` |
| `ANTHROPIC_API_KEY` | | | ● | | |
| `ELEVENLABS_API_KEY` | | | ● | | |
| `NEXT_PUBLIC_APP_URL` | | | ● | ● | `https://app.moyolearn.com` |
| `VITE_APP_URL` | ● | | | | Marketing CTAs → app |
| `SENTRY_DSN` | ● | ● | ● | ● | Separate Sentry projects |

¹ option 3 only.

### 6.1 You cannot read a production secret back, so do not try to verify one

`vercel env pull` returns **every sensitive Production variable as an empty
string**. Production variables are write-only by default, and the pull is not
allowed to decrypt them, so `DATABASE_URL=""` in a pulled file says nothing
whatever about what the variable contains.

This wasted a diagnosis. Pulling `moyo-admin` showed `DATABASE_URL` and
`PAYLOAD_SECRET` as two characters each — the surrounding quotes — which reads
exactly like two empty variables, and `vercel env ls` prints `Encrypted` for an
empty value and a real one alike. The conclusion drawn from that ("both
variables are empty, that is the 500") was **wrong**, and the measurement is
incapable of distinguishing the two cases. Proof, with a throwaway value:

```bash
vercel env add PROBE production --value hello --no-sensitive   # pulls back as 5 chars
vercel env add PROBE production --value hello                  # pulls back as 0 chars
```

Same write path, same value, different readability. Only the second is how a
real secret is stored.

So there is no way to confirm a production secret from outside, and no point
attempting it. Verify by **behaviour** instead — deploy and watch what the app
does — or set the variable again and redeploy, which costs less than any check.

Two related facts, both established by probe rather than assumption:

- **Piping into `vercel env add` works.** `printf '%s' "$v" | vercel env add NAME
  production` stores the value correctly, as does `--value`. An earlier claim
  that stdin silently wrote empty strings was the same redaction artefact.
- **`add` will not overwrite.** Run `vercel env rm NAME production --yes` first,
  or pass `--force`.

Note also that a pulled env file contains `VERCEL_OIDC_TOKEN`. Delete it after
reading; never leave it in a scratch directory.

`moyo-www` losing `DATABASE_URL` and `PAYLOAD_SECRET` is a **result of the rev-4 split, not an oversight**: `apps/web-vite` no longer contains any code that opens a database. If a marketing page ever needs content out of Payload, it fetches `admin.moyolearn.com/payload-api` over the network like any other client — it does not get the credentials back.

Declare every one in `turbo.json` under the `build` task's `env`. Turborepo caches per environment hash — an undeclared var means a staging build can be served as production from cache.

```jsonc
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", ".output/**", ".vercel/output/**"],
      "env": ["DATABASE_URL", "PAYLOAD_SECRET", "BLOB_READ_WRITE_TOKEN",
              "BETTER_AUTH_SECRET", "NEXT_PUBLIC_*", "VITE_*"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 7. Build skipping

Vercel auto-skips builds for projects whose source and internal-dependency source haven't changed. Turborepo-powered, works with any workspace setup. Leave it on.

Manual fallback if it misfires:

```bash
turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages moyo-app --exit-code
```

Tradeoff: builds cancelled via Ignored Build Step still count against deployment and concurrency limits. Auto-skip doesn't.

---

## 8. Cutover checklist

- [ ] Screenshot the full IONOS DNS zone, especially MX/TXT
- [ ] Lower IONOS TTLs to ≤3600; wait for the old TTL to expire
- [ ] Create Vercel projects from the repo; set Root Directory on each
- [ ] Set Framework Preset explicitly on each
- [ ] Deploy all, verify on `*.vercel.app` before touching DNS
- [ ] Neon provisioned; `payload migrate` green from `apps/web`
- [ ] Vercel Blob added; upload a >5 MB file to prove `clientUploads`
- [ ] `PAYLOAD_SECRET` verified identical across all projects
- [ ] Reserved-slug blocklist enforced on `tenants`
- [ ] Delegate IONOS nameservers to Vercel
- [ ] Recreate MX/SPF/DKIM/DMARC in Vercel DNS the same minute
- [ ] Send a test mail to `@moyolearn.com`; confirm delivery
- [ ] Assign all domains; confirm SSL issued incl. the wildcard
- [ ] Confirm `admin.` and `app.` resolve correctly despite the wildcard
- [ ] Verify apex → www returns 308
- [ ] **Verify `nycdoe.moyolearn.com` reaches the portal** — 307 to `/admin` (option 2) or serves at root (option 3)
- [ ] Confirm the redirect is 307, not 308 (check response headers, not the browser)
- [ ] Confirm `/admin` on `moyo-admin` returns `no-store` and `noindex`, and that **neither header appears on `www.moyolearn.com/`**
- [ ] Confirm `admin.moyolearn.com/` 307s to `/admin` rather than 404ing
- [ ] Confirm `moyo-www` has **no** `DATABASE_URL` or `PAYLOAD_SECRET` set
- [ ] Confirm `moyo-www`'s deployed `/` still prerenders to real HTML and its initial JS has not regressed past 155.8 kB gz (ADR-004)
- [ ] Run the cross-tenant tests in `moyo-district-tenancy.md` §10
- [ ] Confirm a preview deployment still authenticates

---

## 9. References

**Vercel**
- Using Monorepos — https://vercel.com/docs/monorepos
- Monorepo FAQ — https://vercel.com/docs/monorepos/monorepo-faq
- Deploying Turborepo — https://vercel.com/docs/monorepos/turborepo
- Auto-skip unaffected deployments — https://vercel.com/changelog/automatically-skip-unnecessary-deployments-in-monorepos
- Ignored Build Step — https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel
- Adding & configuring a custom domain — https://vercel.com/docs/domains/working-with-domains/add-a-domain
- A records with Vercel (wildcard/NS constraint) — https://vercel.com/kb/guide/a-record-and-caa-with-vercel
- Domains troubleshooting — https://vercel.com/docs/domains/troubleshooting
- Multi-tenant quickstart — https://vercel.com/docs/platforms/multi-tenant-platforms/quickstart
- TanStack Start on Vercel — https://vercel.com/docs/frameworks/full-stack/tanstack-start
- Deploy a TanStack Start app — https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel

**TanStack / Nitro**
- Hosting — https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Deploy to Vercel — https://tanstack.com/start/latest/docs/framework/react/deployment/vercel
- Nitro v3 Vercel prerender issue — https://github.com/nitrojs/nitro/issues/3905

**Payload**
- Admin Panel overview (root-level routes) — https://payloadcms.com/docs/admin/overview
- Custom Admin Panel Location — https://payloadcms.com/docs/admin/admin-panel-location
- Multi-tenant plugin — https://payloadcms.com/docs/plugins/multi-tenant
- Production deployment — https://payloadcms.com/docs/production/deployment
- Storage adapters — https://payloadcms.com/docs/upload/storage-adapters
- `@payloadcms/storage-vercel-blob` — https://www.npmjs.com/package/@payloadcms/storage-vercel-blob
- importmap ignores custom admin route (#7803) — https://github.com/payloadcms/payload/issues/7803
- admin route hardcoded (#8947) — https://github.com/payloadcms/payload/issues/8947
- Relocating the Payload admin folder (#15580) — https://github.com/payloadcms/payload/discussions/15580
- TanStack adapter demo — https://github.com/payloadcms/payload-tanstack-demo

**IONOS**
- Using your own nameservers — https://www.ionos.com/help/domains/using-your-own-name-servers/using-your-own-name-servers-for-a-domain/

**Bun (planned migration)**
- TanStack Start with Bun — https://bun.com/guides/ecosystem/tanstack-start
  (on Vercel: set `"bunVersion": "1.x"` in `vercel.json`; do **not** use the `bun` Nitro preset)
