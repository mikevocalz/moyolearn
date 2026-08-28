// The host step, proved end to end through `protectedOperation` — the Block's
// real session branch, not the mock one.
//
// Three of these are the reason the work exists and everything else is support:
//   · a user who belongs only to NYCDOE is refused at Chicago's address;
//   · a user who belongs to BOTH, standing at NYCDOE's address with a session
//     claim hand-forged to say Chicago, reads NYCDOE's rows — never Chicago's;
//   · `admin.`, `app.` and a `*.vercel.app` preview carry no tenant context AND
//     never touch the organizations table, so "no district named" can never
//     become "read everything".
//
// The operation under test LISTS ROWS out of a fixture keyed by `ctx.orgId`,
// rather than asserting on the ctx object. Asserting the field would prove the
// Block computed a string; listing rows proves the string is the one the data
// came out under, which is the claim that matters.
//
// `.server-test.ts` because the Block imports `@acme/auth/server`. The `Auth`
// stub is real here — unlike the mock-mode tests beside it, this path calls
// `auth.api.getSession`, so the stub answers that one method and nothing else.
// SOT: docs/deploy/moyo-district-tenancy.md §5 §10 · docs/pack/11-architectural-guardrails.md §3 · CLAUDE.md §The block
// SOT-KEYWORDS: host tenant server test district cross-tenant forged claim preview vercel admin app unscoped read intersect protected operation

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { Auth } from '@acme/auth/server';
import type { MembershipRole } from '@acme/auth/membership';
import type { LoadSubscriptions } from './capability-gate.ts';
import { MembershipDenied } from './membership-gate.ts';
import { HostTenantDenied, setTenantOrgReader, type LoadTenantOrgId } from './host-tenant.ts';
import { protectedOperation, type ProtectedCtx } from './protected-operation.ts';
import { setOperationSink } from './telemetry.ts';

const ROOT = 'moyolearn.com';

/** The two districts, and the rows a cross-tenant read would expose. */
const ROWS: Readonly<Record<string, readonly string[]>> = {
  nycdoe: ['nycdoe-lead-1', 'nycdoe-lead-2'],
  chicago: ['chicago-lead-1'],
};

/** Who actually holds a seat where — the `member` table, as a fixture. */
const MEMBERSHIPS: Readonly<Record<string, readonly string[]>> = {
  'user-nycdoe-only': ['nycdoe'],
  'user-chicago-only': ['chicago'],
  'user-both': ['nycdoe', 'chicago'],
  'user-guardian': [],
};

interface SessionUser {
  id: string;
  guardianManaged?: boolean;
  orgId?: string;
}

/**
 * An `Auth` that answers `getSession` and nothing else. Built with
 * `Object.assign` rather than a cast through `unknown`, which this codebase
 * bans: the result is `Auth & { api }`, so the stub is typed rather than
 * asserted.
 */
const authFor = (user: SessionUser): Auth =>
  Object.assign({} as Auth, {
    api: { getSession: async (): Promise<{ user: SessionUser }> => ({ user }) },
  });

const headersFor = (host: string): Headers => new Headers({ 'x-forwarded-host': host });

/** The role port, reading the membership fixture. Identity comes off `ctx`. */
const loadMembershipRole = async (c: ProtectedCtx): Promise<MembershipRole | null> =>
  c.orgId && (MEMBERSHIPS[c.learnerId] ?? []).includes(c.orgId) ? 'owner' : null;

/** Every plan says yes, so nothing below is a capability refusal in disguise. */
const loadSubscriptions: LoadSubscriptions = async () => [
  { plan: 'ops-studio', status: 'active', referenceId: null, periodEnd: null },
];

/** The `organizations` read, with a call log so "no unscoped read" is provable. */
const lookups: string[] = [];
const loadTenantOrgId: LoadTenantOrgId = async (slug) => {
  lookups.push(slug);
  return slug in ROWS ? slug : null;
};

/** What the operation does: read the rows of whatever org the Block scoped it to. */
const listRows = async (ctx: ProtectedCtx): Promise<readonly string[]> =>
  ctx.orgId ? (ROWS[ctx.orgId] ?? []) : [];

const runAt = (host: string, user: SessionUser) =>
  protectedOperation(authFor(user), headersFor(host), listRows, {
    requires: 'export',
    loadMembershipRole,
    loadSubscriptions,
    loadTenantOrgId,
  });

before(() => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
  // The session branch, not the mock one — this whole file is about a real
  // account's real memberships.
  delete process.env.NEXT_PUBLIC_AUTH_MODE;
  setOperationSink(() => {});
});
after(() => {
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  setTenantOrgReader(null);
  setOperationSink(null);
});
beforeEach(() => {
  lookups.length = 0;
});

describe('a district host refuses an account with no claim on it', () => {
  it("refuses a NYCDOE-only account at Chicago's address", async () => {
    const denied = await runAt(`chicago.${ROOT}`, { id: 'user-nycdoe-only', orgId: 'nycdoe' }).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof HostTenantDenied);
    // 403, and a `MembershipDenied` — so every route that already maps a refusal
    // maps this one, and no refusal can arrive dressed as a 402 upsell.
    assert.ok(denied instanceof MembershipDenied);
    assert.equal(denied.status, 403);
    assert.doesNotMatch(denied.message, /\$|upgrade|plan|price|trial|subscri/i);
  });

  it('names no district in the message — the refusal must not enumerate', async () => {
    const denied = await runAt(`chicago.${ROOT}`, { id: 'user-nycdoe-only' }).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof HostTenantDenied);
    assert.doesNotMatch(denied.message, /chicago|nycdoe|district/i);
  });

  it('refuses a guardian at a district address, whatever their plan says', async () => {
    await assert.rejects(
      () => runAt(`nycdoe.${ROOT}`, { id: 'user-guardian', guardianManaged: true }),
      HostTenantDenied,
    );
  });

  it('does not let the host GRANT — it can only narrow', async () => {
    // The account's own claim says NYCDOE and its membership agrees; the address
    // says Chicago, where it holds nothing. If the host were merely adopted
    // rather than intersected, this would read Chicago's row.
    const denied = await runAt(`chicago.${ROOT}`, { id: 'user-nycdoe-only', orgId: 'nycdoe' }).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof HostTenantDenied);
  });
});

describe('the host wins over the session claim', () => {
  it("lists only NYCDOE's rows for a user of both districts on NYCDOE's host", async () => {
    const rows = await runAt(`nycdoe.${ROOT}`, { id: 'user-both', orgId: 'nycdoe' });
    assert.deepEqual(rows, ROWS.nycdoe);
  });

  it("lists NYCDOE's rows — never Chicago's — when the claim is forged to say Chicago", async () => {
    /*
      THE TEST. Same user, genuinely a member of both districts, standing at
      NYCDOE's address with a session whose `orgId` has been hand-edited to
      Chicago. Before the host step this returned Chicago's row: `ctx.orgId` came
      straight off `user.orgId`. The address is the thing the caller cannot
      forge while still arriving here, so it is the thing that decides.
    */
    const rows = await runAt(`nycdoe.${ROOT}`, { id: 'user-both', orgId: 'chicago' });
    assert.deepEqual(rows, ROWS.nycdoe);
    for (const row of ROWS.chicago ?? []) {
      assert.ok(!rows.includes(row), `leaked ${row}`);
    }
  });

  it('scopes to the host even when the session carries no org at all', async () => {
    const rows = await runAt(`chicago.${ROOT}`, { id: 'user-both' });
    assert.deepEqual(rows, ROWS.chicago);
  });
});

describe('a host with no district carries no tenant context — and no unscoped read', () => {
  const NON_TENANT = [`admin.${ROOT}`, `app.${ROOT}`, `www.${ROOT}`, ROOT];

  it('leaves the session scope exactly as it was', async () => {
    for (const host of NON_TENANT) {
      const rows = await protectedOperation(
        authFor({ id: 'user-both', orgId: 'chicago' }),
        headersFor(host),
        listRows,
        { requires: 'export', loadMembershipRole, loadSubscriptions, loadTenantOrgId },
      );
      // Today's behaviour, byte for byte: the session's own org, not a district.
      assert.deepEqual(rows, ROWS.chicago, host);
    }
  });

  it('never queries the organizations table for admin. / app. / www. / the apex', async () => {
    for (const host of NON_TENANT) {
      await runAt(host, { id: 'user-both', orgId: 'chicago' });
    }
    assert.deepEqual(lookups, []);
  });

  it('treats a *.vercel.app preview as no tenant context and reads nothing', async () => {
    const rows = await runAt('moyo-git-branch-acme.vercel.app', {
      id: 'user-both',
      orgId: 'nycdoe',
    });
    assert.deepEqual(rows, ROWS.nycdoe);
    assert.deepEqual(lookups, []);
  });

  it('treats a nested subdomain as no tenant context and reads nothing', async () => {
    const rows = await runAt(`staging.nycdoe.${ROOT}`, { id: 'user-both', orgId: 'chicago' });
    assert.deepEqual(rows, ROWS.chicago);
    assert.deepEqual(lookups, []);
  });

  it('still refuses an unauthenticated caller at a non-tenant host', async () => {
    const noSession = Object.assign({} as Auth, { api: { getSession: async () => null } });
    await assert.rejects(
      () =>
        protectedOperation(noSession, headersFor(`app.${ROOT}`), listRows, {
          requires: 'export',
          loadTenantOrgId,
        }),
      /Unauthenticated/,
    );
  });
});

describe('resolution failures fail closed', () => {
  it('refuses a district-shaped host that matches no organisation', async () => {
    await assert.rejects(
      () => runAt(`not-a-district.${ROOT}`, { id: 'user-both', orgId: 'nycdoe' }),
      HostTenantDenied,
    );
    assert.deepEqual(lookups, ['not-a-district']);
  });

  it('refuses a district host when no reader is wired, rather than falling back', async () => {
    const denied = await protectedOperation(
      authFor({ id: 'user-both', orgId: 'nycdoe' }),
      headersFor(`nycdoe.${ROOT}`),
      listRows,
      { requires: 'export', loadMembershipRole, loadSubscriptions, loadTenantOrgId: null },
    ).catch((error: Error) => error);
    assert.ok(denied instanceof HostTenantDenied);
  });

  it('refuses when the lookup throws — a database that cannot answer is not a pass', async () => {
    await assert.rejects(
      () =>
        protectedOperation(
          authFor({ id: 'user-both', orgId: 'nycdoe' }),
          headersFor(`nycdoe.${ROOT}`),
          listRows,
          {
            requires: 'export',
            loadMembershipRole,
            loadSubscriptions,
            loadTenantOrgId: async () => {
              throw new Error('connection refused');
            },
          },
        ),
      HostTenantDenied,
    );
  });

  it('runs the operation not at all when the host refuses', async () => {
    let ran = false;
    await protectedOperation(
      authFor({ id: 'user-nycdoe-only' }),
      headersFor(`chicago.${ROOT}`),
      async () => {
        ran = true;
        return [];
      },
      { requires: 'export', loadMembershipRole, loadSubscriptions, loadTenantOrgId },
    ).catch(() => undefined);
    assert.equal(ran, false);
  });
});

describe('the registered reader is used when no override is passed', () => {
  it('resolves through setTenantOrgReader, so no route has to wire one', async () => {
    setTenantOrgReader(loadTenantOrgId);
    try {
      const rows = await protectedOperation(
        authFor({ id: 'user-both', orgId: 'chicago' }),
        headersFor(`nycdoe.${ROOT}`),
        listRows,
        { requires: 'export', loadMembershipRole, loadSubscriptions },
      );
      assert.deepEqual(rows, ROWS.nycdoe);
      assert.deepEqual(lookups, ['nycdoe']);
    } finally {
      setTenantOrgReader(null);
    }
  });
});

describe('the host step composes with the role gate', () => {
  it('admits a staff member of the host district to a role-gated operation', async () => {
    const rows = await protectedOperation(
      authFor({ id: 'user-both', orgId: 'chicago' }),
      headersFor(`nycdoe.${ROOT}`),
      listRows,
      {
        requires: 'export',
        requiresMembership: ['owner', 'manager'],
        loadMembershipRole,
        loadSubscriptions,
        loadTenantOrgId,
      },
    );
    assert.deepEqual(rows, ROWS.nycdoe);
  });

  it('reads the member row once per organisation, not once per gate', async () => {
    // Both the host step and the role gate ask about the same org; slo.md §1.1
    // budgets 150 ms for context assembly and two round trips is half of it.
    let reads = 0;
    await protectedOperation(
      authFor({ id: 'user-both', orgId: 'chicago' }),
      headersFor(`nycdoe.${ROOT}`),
      listRows,
      {
        requires: 'export',
        requiresMembership: ['owner'],
        loadSubscriptions,
        loadTenantOrgId,
        loadMembershipRole: async (c) => {
          reads += 1;
          return loadMembershipRole(c);
        },
      },
    );
    assert.equal(reads, 1);
  });
});
