// Server-side authorization boundary.
// Every operation that reaches the Safety Plane, payload repositories, or the
// learner model must run inside a protectedOperation so identity is never a
// parameter and unauthenticated callers fail closed.
//
// Doc 11 §3 orders the gates inside this block: session → context →
// MEMBERSHIP/ROLE → PLAN & ENTITLEMENT → handler. Both gates are here, not on
// the client: `PermissionGate` decides what a screen SHOWS, and a screen is not
// a boundary. The role step runs BEFORE the plan step because their refusals
// mean different things — a 403 role refusal is never allowed to surface as a
// 402, which is an upsell.
// Doc 12 §7 also makes this the one place uniform telemetry can come from —
// "every operation logs {op, resource, action, ctx.kind, latency, outcome}".
// The record is built and emitted in the `finally` below; the shape, and why
// naming the operation is optional, are in `telemetry.ts`.
//
// The HOST step runs before both gates, because it decides what `ctx.orgId` IS
// and every gate below reads that field. See `host-tenant.ts` for why the
// address outranks the session's own claim.
// SOT: docs/pack/06-auth-onboarding-spec.md §7 · docs/pack/07-security-child-ai-safety-spec.md §2 · docs/pack/11-architectural-guardrails.md §3 · docs/pack/12-systems-design-prompt.md §7 · docs/deploy/moyo-district-tenancy.md §5
// SOT-KEYWORDS: protected operation auth boundary server-only learner context mock capability plan entitlement telemetry record latency outcome host tenant district scoping
import 'server-only';
import { readMembershipRole, readSubscriptions, type Auth } from '@acme/auth/server';
import type { Capability, SubscriptionState } from '@acme/auth/entitlements';
import type { MembershipRole } from '@acme/auth/membership';
import { HostTenantDenied, resolveHostTenant, type LoadTenantOrgId } from './host-tenant.ts';
import { billingReferenceFor, withCapability, CapabilityDenied, type LoadSubscriptions } from './capability-gate.ts';
import {
  withMembership,
  MembershipDenied,
  type LoadMembershipRole,
  type RequiredMembership,
} from './membership-gate.ts';
import {
  InstitutionPermissionDenied,
  requirePermission,
} from '../features/institution/institution.policy.ts';
import type { InstitutionAction, InstitutionResource, InstitutionScope } from '../features/institution/institution.types.ts';
import { roleForOrganizationRoleAndKind, type OrganizationKind } from '../providers/session/role-mapping.ts';
import {
  ctxKindOf,
  operationRecord,
  recordOperation,
  type OperationCtxKind,
  type OperationDescriptor,
  type OperationOutcome,
} from './telemetry.ts';

export interface ProtectedCtx {
  /** The acting learner's Better Auth user id. */
  learnerId: string;
  /** Whether the account is guardian-managed (a child learner). */
  isLearner: boolean;
  /** Organization id when the session is scoped to one. */
  orgId?: string;
}

export type LoadOrgKind = (ctx: ProtectedCtx) => Promise<OrganizationKind | null>;

let orgKindReader: LoadOrgKind | null = null;

export function setOrgKindReader(next: LoadOrgKind | null): void {
  orgKindReader = next;
}

export interface ProtectedOperationOptions {
  /**
   * What the operation costs. Defaults to `practise`, which doc 05 §1.2 makes
   * true on every subscription status there is — INCLUDING none at all.
   *
   * That default is the free floor, not an absent gate. An operation whose
   * author forgets this argument runs at a child's practice level and nowhere
   * above it, so forgetting downgrades the operation instead of exempting it.
   * Anything that writes a business's data, moves money, or exports names its
   * capability explicitly.
   *
   * Defaulting to `write` was the other candidate and is wrong here: it would
   * put a lapsed family card between a child and their practice, which doc 05
   * §1.2 and CLAUDE.md both forbid outright.
   */
  requires?: Capability;
  /**
   * The organisation roles allowed to run this operation — the STAFF wall, and
   * a different question from `requires`. `requires` asks what the caller's
   * plan pays for; this asks who the caller IS to the org, and no subscription
   * status can answer it: an active family plan satisfies `write`, and a
   * guardian must still never reach an incident queue. Absent means the
   * operation is not staff work, not that the wall is open by default — a
   * staff surface that forgets this argument is the bug doc 11 §3's ordering
   * exists to name, which is why every staff service sets it inside the
   * service, where no route can lower it.
   *
   * Non-empty by type (`RequiredMembership`); denial is `MembershipDenied`,
   * 403-shaped and never an upsell.
   */
  requiresMembership?: RequiredMembership;
  /**
   * Overrides where the caller's org role is read from — tests only, same
   * contract as `loadSubscriptions`. The default reads the organization
   * plugin's own `member` table with both ids off `ctx`, so no route wires a
   * reader and none can wire the wrong one.
   */
  loadMembershipRole?: LoadMembershipRole;
  /**
   * Overrides where the tenant org id is read from. The default is a real
   * lookup; tests inject a fixed table so the host-tenant branch is testable
   * without a CMS connection.
   */
  loadTenantOrgId?: LoadTenantOrgId | null;
  /**
   * Reads the kind of the current organization so the institution permission
   * policy can map `MembershipRole` to `RoleKind`. Required when
   * `requiresInstitution` is used; tests inject a fixture so the policy gate
   * is testable without a CMS connection.
   */
  loadOrgKind?: LoadOrgKind;
  /**
   * An institutional permission check: { scope, resource, action }. The caller
   * must hold the required permission for the current tenant scope after host
   * and membership have been resolved. Fail-closed: missing `loadOrgKind` or
   * a role that cannot be resolved is a refusal.
   */
  requiresInstitution?: { scope: InstitutionScope; resource: InstitutionResource; action: InstitutionAction };
  /**
   * Overrides where the caller's plan is read from. Production never passes
   * this — the default reads Better Auth's own subscription rows through the
   * `auth` instance already in hand, so no route has to wire a reader and no
   * route can wire the wrong one.
   */
  loadSubscriptions?: LoadSubscriptions;
  /**
   * What this operation IS, for the telemetry record.
   *
   * Optional on purpose (see `telemetry.ts`): making it required would be an
   * API change to every call site at once, including ones owned elsewhere, and
   * the record is worth more emitted-and-unnamed than not emitted at all. An
   * operation that omits it is recorded as `attributed: false` so the gap is
   * countable on the dashboard rather than invisible.
   */
  telemetry?: OperationDescriptor;
}

const MOCK_CTX: ProtectedCtx = {
  learnerId: 'dev-learner-1',
  isLearner: true,
  /*
    The mock session carries an org too. Without one every org-scoped read
    fails closed to an empty result, and the ops dashboard looks broken in
    exactly the mode it is meant to be developed in.

    It is a REAL slug from the organizations table, not a `dev-org-1`
    placeholder: a mock tenant key that matches no row reads as "the query is
    broken" rather than "you are signed in as nobody".
  */
  orgId: 'riverside-unified',
};

/*
  The mock session's plans, keyed to the mock ctx's own reference ids for the
  same reason the mock org is a real slug: a subscription filed against an id
  nothing matches projects to NO_SUBSCRIPTION, and every paid surface in dev
  would then read as broken rather than as unpaid. `ops-studio` because it is the
  tier carrying a non-zero limit, so doc 06 §4's payout gate is reachable in the
  mode it is developed in.
*/
const MOCK_SUBSCRIPTIONS: SubscriptionState[] = [
  { plan: 'family', status: 'active', referenceId: MOCK_CTX.learnerId, periodEnd: null },
  { plan: 'ops-studio', status: 'active', referenceId: MOCK_CTX.orgId ?? null, periodEnd: null },
];

/*
  The mock's org role: none. If identity is a fixture, its attributes are too
  (see `isMockAuth`), and this identity is a guardian-managed LEARNER — a child
  holds no row in any org's member table, so the honest fixture is null and
  every `requiresMembership` surface refuses the mock in dev. That refusal is
  the point, not a gap: the vulnerability this gate closes was precisely a
  family-shaped session reaching staff surfaces, and a mock that waved itself
  through would develop every staff screen against a wall that is open.
  Staff-surface work in dev runs as a real org member, or a test passes
  `loadMembershipRole` explicitly.
*/
const MOCK_MEMBERSHIP_ROLE = null;

/**
 * Runs an operation inside an authenticated, learner-scoped context whose plan
 * includes `options.requires`.
 *
 * The caller passes the `Auth` instance and the request headers. This function
 * derives the session and hands the operation a `ProtectedCtx`. It never asks
 * the operation to validate identity or accept an id as input.
 *
 * In dev with `NEXT_PUBLIC_AUTH_MODE=mock`, a deterministic mock learner is
 * used so that features can be exercised without a real Better Auth session.
 * The capability gate still runs against that mock's plans — a dev typo in a
 * capability name has to fail in dev, not first in production.
 */
/**
 * The one definition of "this process is running a mock identity".
 *
 * Exported because it has to be shared, not restated. The Block mocks the
 * learner in dev, and a downstream layer that reads that learner's ATTRIBUTES
 * from the real database is asking about somebody who does not exist — which is
 * exactly what happened: `loadLearnerFlags` threw on a Better Auth table this
 * project has never had, the throw reached `safetyLayer('1-identity')`, and
 * every coaching turn in dev came back `blocked`. The child would have been
 * told "Natalie is taking a break" forever, and the mechanism reporting it was
 * working perfectly.
 *
 * Half-mocked is the bug. If identity is a fixture, its attributes are too.
 */
export function isMockAuth(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV === 'development';
}

export async function protectedOperation<R>(
  auth: Auth,
  headers: Headers,
  operation: (ctx: ProtectedCtx) => Promise<R>,
  options: ProtectedOperationOptions = {},
): Promise<R> {
  const capability = options.requires ?? 'practise';
  const isMock = isMockAuth();

  /*
    Captured before the session read, so the recorded latency is the whole block
    — session, capability gate and handler. That is the quantity slo.md §1.1
    budgets at 150 ms for context assembly and LAT-1 measures at p95; timing
    only the handler would hide a slow `getSession` behind a fast operation.
  */
  const startedAt = performance.now();
  let ctxKind: OperationCtxKind = 'anonymous';
  let outcome: OperationOutcome = 'error';

  /*
    Doc 11 §3's ordering, held in one place for both branches: membership/role
    wraps the plan gate, so a caller who is not staff is refused before a
    subscription is ever read — and a role refusal can never arrive dressed as
    a 402.
  */
  const membership = options.requiresMembership;
  const gated = (
    c: ProtectedCtx,
    loadRole: LoadMembershipRole,
    loadSubs: LoadSubscriptions,
  ): Promise<R> => {
    const planGated = (cc: ProtectedCtx) => withCapability(cc, capability, loadSubs, operation);
    return membership ? withMembership(c, membership, loadRole, planGated) : planGated(c);
  };

  try {
    if (isMock) {
      /*
        The mock branch takes NO host step, and that is the same rule
        `MOCK_MEMBERSHIP_ROLE` follows: if identity is a fixture, its attributes
        are too. Host scoping is a statement about a real account's real rows in
        the `member` table, and the mock has none to intersect with — a mock that
        adopted the host org would be granting itself a district on the strength
        of a URL, which is the exact move this step exists to refuse. Dev on
        `localhost` names no district anyway, so this changes nothing there.
      */
      ctxKind = ctxKindOf(MOCK_CTX);
      const loadMock: LoadSubscriptions = options.loadSubscriptions ?? (async () => MOCK_SUBSCRIPTIONS);
      const loadMockRole: LoadMembershipRole =
        options.loadMembershipRole ?? (async () => MOCK_MEMBERSHIP_ROLE);
      const result = await gated(MOCK_CTX, loadMockRole, loadMock);
      outcome = 'ok';
      return result;
    }

    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error('Unauthenticated');

    const user = session.user as { id: string; guardianManaged?: boolean; orgId?: string };
    /*
      The session's own scope. It is a STARTING POINT, not the answer: `orgId`
      here is what the account defaults to, which is a value the caller carries
      and can be stale, multi-valued or — in the case this step was written for —
      simply not the district whose address they are standing at.
    */
    const sessionCtx: ProtectedCtx = {
      learnerId: user.id,
      isLearner: !!user.guardianManaged,
      orgId: user.orgId,
    };
    // Recorded before the host step so a host refusal is still attributed to the
    // kind of caller it refused; re-derived below once the org is settled.
    ctxKind = ctxKindOf(sessionCtx);

    /*
      The host step: the address the request arrived at wins over the session's
      own org claim. A district-shaped host narrows the context to that district
      and refuses the operation if the caller has no role there; an `app.`,
      `admin.` or preview host carries no tenant and leaves the session scope as
      the starting point. The reader is a port so tests can inject a fixture.
    */
    const host = options.loadTenantOrgId
      ? await resolveHostTenant(headers, options.loadTenantOrgId)
      : await resolveHostTenant(headers);
    if (host.kind === 'unresolved') throw new HostTenantDenied(host.slug);
    const hostCtx: ProtectedCtx = {
      ...sessionCtx,
      orgId: host.kind === 'org' ? host.orgId : sessionCtx.orgId,
    };

    const load: LoadSubscriptions =
      options.loadSubscriptions ??
      /*
        Read once per operation and never cached across requests: a subscription
        that lapsed, or a card that just cleared, has to take effect on the next
        call rather than whenever a process happens to recycle.
      */
      ((c) => readSubscriptions(auth, billingReferenceFor(c)));

    /*
      Both ids off `ctx`, never off input — the role is the acting user's role
      in the org their SESSION is scoped to, which is what makes a posted org
      id worthless here.
    */
    const loadRole: LoadMembershipRole =
      options.loadMembershipRole ??
      ((c) => (c.orgId ? readMembershipRole(auth, c.orgId, c.learnerId) : Promise.resolve(null)));

    let membershipRole: MembershipRole | undefined;
    if (host.kind === 'org') {
      const held = await loadRole(hostCtx);
      if (held === null) throw new HostTenantDenied(host.orgId);
      membershipRole = held;
    }

    const opLoadRole: LoadMembershipRole = async (c) => {
      if (c === hostCtx && membershipRole !== undefined) return membershipRole;
      return loadRole(c);
    };

    const heldRole = await opLoadRole(hostCtx);

    if (options.requiresInstitution) {
      const reader = options.loadOrgKind ?? orgKindReader;
      const orgKind = reader ? await reader(hostCtx) : null;
      const roleKind = roleForOrganizationRoleAndKind(heldRole, orgKind ?? undefined);
      requirePermission(
        roleKind,
        options.requiresInstitution.scope,
        options.requiresInstitution.resource,
        options.requiresInstitution.action,
        () => undefined,
      );
    }

    const result = await gated(hostCtx, opLoadRole, load);
    outcome = 'ok';
    return result;
  } catch (error) {
    /*
      A refusal is not a failure. `denied` and `unauthenticated` are the block
      doing its job, and folding them into `error` would burn SLO-3's budget
      every time a lapsed card is correctly turned away (slo.md §4.4) — or, for
      the role gate, every time a family session is correctly turned away from
      a staff surface.
    */
    outcome =
      error instanceof CapabilityDenied ||
      error instanceof MembershipDenied ||
      error instanceof InstitutionPermissionDenied
        ? 'denied'
        : error instanceof Error && error.message === 'Unauthenticated'
          ? 'unauthenticated'
          : 'error';
    throw error;
  } finally {
    recordOperation(
      operationRecord({
        descriptor: options.telemetry,
        capability,
        ctxKind,
        outcome,
        latencyMs: performance.now() - startedAt,
        authMode: isMock ? 'mock' : 'session',
      }),
    );
  }
}
