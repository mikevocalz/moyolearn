// Binds the Block's host step to the `organizations` collection, once per
// process.
//
// A side-effect module rather than an option on `protectedOperation`, for the
// reason `sentry.server.config.ts` installs the telemetry sink the same way: a
// port that every route has to remember to pass is a port one route will forget,
// and for THIS port a forgotten wire is a district host scoped by the caller's
// own claim — the exact bug the host step exists to close. Registering it in
// `instrumentation.ts`'s `register()` means it is in place before the first
// request, wherever that request lands.
//
// It is loaded from `instrumentation.ts` and nowhere else. In particular NOT
// from `lib/auth.ts`, which `middleware.ts` imports dynamically: that would pull
// the Payload config into the middleware bundle to satisfy a step middleware
// never runs.
//
// If this never runs, the Block does not fall open — `resolveHostTenant`
// answers `unresolved` for any district host and every district request is
// refused. Loud and confined to the subdomains, instead of silent and everywhere.
// SOT: CLAUDE.md §The block · docs/deploy/moyo-district-tenancy.md §4 §5
// SOT-KEYWORDS: tenancy wiring host tenant reader register instrumentation organizations repository block
import 'server-only';
import { setTenantOrgReader } from '@acme/app/server';
import { loadTenantOrgId } from './org.repository';

setTenantOrgReader(loadTenantOrgId);
