// The host→tenant parse, proved case by case.
//
// Every assertion here is a hole that would otherwise be open: a nested
// subdomain reaching a lookup, a preview deployment resolving to a district, a
// `Host` header outranking `x-forwarded-host` behind Vercel's proxy. The parse
// is pure, so all of it is testable without a database — which is the reason it
// was made pure.
// SOT: docs/deploy/moyo-district-tenancy.md §4 · packages/auth/src/host-tenant.ts
// SOT-KEYWORDS: host tenant test subdomain nested preview vercel forwarded host port non-tenant login scoping

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  DEFAULT_ROOT_DOMAIN,
  NON_TENANT_HOSTS,
  hostFromHeaderValues,
  hostFromHeaders,
  permitsLoginAtHost,
  rootDomain,
  tenantSlugFromHeaders,
  tenantSlugFromHost,
} from './host-tenant.ts';

const ROOT = 'moyolearn.com';

before(() => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
});
after(() => {
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
});

describe('the root domain', () => {
  it('falls back to the production apex when nothing is configured', () => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    assert.equal(rootDomain(), DEFAULT_ROOT_DOMAIN);
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
  });

  it('follows the env var, so `nycdoe.localhost` is a district in dev', () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost';
    assert.equal(tenantSlugFromHost('nycdoe.localhost'), 'nycdoe');
    assert.equal(tenantSlugFromHost('nycdoe.moyolearn.com'), null);
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
  });
});

describe('which header names the client-facing host', () => {
  it('prefers x-forwarded-host — behind Vercel, `host` is the deployment', () => {
    assert.equal(
      hostFromHeaderValues('nycdoe.moyolearn.com', 'moyo-abc123.vercel.app'),
      'nycdoe.moyolearn.com',
    );
  });

  it('falls back to `host` when nothing is proxying', () => {
    assert.equal(hostFromHeaderValues(null, 'nycdoe.moyolearn.com'), 'nycdoe.moyolearn.com');
  });

  it('honours only the FIRST hop of a forwarded chain', () => {
    // Appending to the chain is the one part of it an upstream controls; taking
    // the last entry would let it nominate a district.
    assert.equal(
      hostFromHeaderValues('nycdoe.moyolearn.com, chicago.moyolearn.com', null),
      'nycdoe.moyolearn.com',
    );
  });

  it('strips the port and lowercases', () => {
    assert.equal(hostFromHeaderValues('NYCDOE.Moyolearn.com:3000', null), 'nycdoe.moyolearn.com');
  });

  it('reads real Headers the same way', () => {
    const headers = new Headers({
      'x-forwarded-host': 'nycdoe.moyolearn.com',
      host: 'moyo-abc123.vercel.app',
    });
    assert.equal(hostFromHeaders(headers), 'nycdoe.moyolearn.com');
    assert.equal(tenantSlugFromHeaders(headers), 'nycdoe');
  });

  it('is null when neither header is present', () => {
    assert.equal(hostFromHeaders(new Headers()), null);
    assert.equal(tenantSlugFromHeaders(new Headers()), null);
  });
});

describe('a host resolves to a district', () => {
  it('takes the single label under the root domain', () => {
    assert.equal(tenantSlugFromHost('nycdoe.moyolearn.com'), 'nycdoe');
    assert.equal(tenantSlugFromHost('riverside-unified.moyolearn.com'), 'riverside-unified');
  });
});

describe('a host resolves to NO tenant context', () => {
  it('rejects a nested subdomain — a wildcard certificate covers one level', () => {
    assert.equal(tenantSlugFromHost('a.b.moyolearn.com'), null);
    assert.equal(tenantSlugFromHost('staging.nycdoe.moyolearn.com'), null);
  });

  it('rejects the apex itself', () => {
    assert.equal(tenantSlugFromHost('moyolearn.com'), null);
  });

  it('rejects preview deployments — *.vercel.app is not under the root domain', () => {
    assert.equal(tenantSlugFromHost('moyo-git-branch-acme.vercel.app'), null);
    assert.equal(tenantSlugFromHost('moyolearn.com.evil.example'), null);
  });

  it('rejects a suffix that merely ends in the root domain without a dot', () => {
    // `notmoyolearn.com` ends with "moyolearn.com" as a SUBSTRING; the leading
    // dot in the suffix check is what stops an attacker registering it.
    assert.equal(tenantSlugFromHost('notmoyolearn.com'), null);
  });

  it("rejects Moyo's own surfaces", () => {
    for (const label of NON_TENANT_HOSTS) {
      assert.equal(tenantSlugFromHost(`${label}.${ROOT}`), null, label);
    }
  });

  it('rejects labels that are not legal DNS labels', () => {
    assert.equal(tenantSlugFromHost('-nycdoe.moyolearn.com'), null);
    assert.equal(tenantSlugFromHost('nycdoe-.moyolearn.com'), null);
    assert.equal(tenantSlugFromHost('ny_doe.moyolearn.com'), null);
    assert.equal(tenantSlugFromHost(`${'a'.repeat(64)}.moyolearn.com`), null);
  });

  it('rejects an empty host', () => {
    assert.equal(tenantSlugFromHost(null), null);
    assert.equal(tenantSlugFromHost(''), null);
    assert.equal(tenantSlugFromHost('.moyolearn.com'), null);
  });
});

describe('login scoping', () => {
  it('lets anyone authenticate where no district is named', () => {
    // app. / admin. / dev / preview: a guardian holds no org role by design and
    // must still be able to sign in.
    assert.equal(permitsLoginAtHost(null, null), true);
  });

  it('refuses a district host to an account holding no role there', () => {
    assert.equal(permitsLoginAtHost('nycdoe', null), false);
    assert.equal(permitsLoginAtHost('nycdoe', undefined), false);
    assert.equal(permitsLoginAtHost('nycdoe', ''), false);
  });

  it('permits a district host to a member of that district', () => {
    assert.equal(permitsLoginAtHost('nycdoe', 'owner'), true);
  });
});
