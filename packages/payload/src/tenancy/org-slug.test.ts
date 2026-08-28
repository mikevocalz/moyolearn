// The tenant key's write-time rule, proved.
//
// The two cases that matter are the ones that cost something real: a district
// registering `app` or `www` shadows a production host, and a slug that is not
// a legal DNS label is a district whose subdomain silently never resolves. Both
// are cheap to assert here and expensive to discover in an audit.
// SOT: docs/deploy/moyo-district-tenancy.md §3 §10 · packages/payload/src/collections/org-slug.ts
// SOT-KEYWORDS: org slug reserved test validation hostname label district tenant key organizations

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ORG_SLUG_PATTERN, RESERVED_ORG_SLUGS, validateOrgSlug } from './org-slug.ts';

describe('a reserved tenant key is refused', () => {
  it('refuses every name on the list, naming it', () => {
    for (const slug of RESERVED_ORG_SLUGS) {
      const result = validateOrgSlug(slug);
      assert.notEqual(result, true, slug);
      assert.match(String(result), /reserved/i, slug);
    }
  });

  it("covers the three hosts the app itself serves — the collision that takes a surface down", () => {
    // `NON_TENANT_HOSTS` in @acme/auth/host-tenant. The read side refuses these
    // labels too; this is what stops the row from existing in the first place.
    for (const label of ['app', 'admin', 'www']) {
      assert.ok(RESERVED_ORG_SLUGS.includes(label), label);
      assert.notEqual(validateOrgSlug(label), true, label);
    }
  });
});

describe('the hostname shape is enforced', () => {
  it('refuses characters no DNS label may carry', () => {
    for (const bad of ['NYCDOE', 'ny_doe', 'ny doe', 'nyc.doe', 'nycdoe!', 'nycdoé']) {
      assert.notEqual(validateOrgSlug(bad), true, bad);
    }
  });

  it('refuses a leading or trailing hyphen', () => {
    assert.notEqual(validateOrgSlug('-nycdoe'), true);
    assert.notEqual(validateOrgSlug('nycdoe-'), true);
  });

  it('refuses more than 63 characters', () => {
    assert.equal(validateOrgSlug('a'.repeat(63)), true);
    assert.notEqual(validateOrgSlug('a'.repeat(64)), true);
  });

  it('refuses an empty or missing key', () => {
    assert.notEqual(validateOrgSlug(''), true);
    assert.notEqual(validateOrgSlug(null), true);
    assert.notEqual(validateOrgSlug(undefined), true);
  });

  it('accepts the keys real districts use', () => {
    for (const good of ['nycdoe', 'chicago', 'riverside-unified', 'lincoln-public', 'k12']) {
      assert.equal(validateOrgSlug(good), true, good);
    }
  });

  it('states the same label rule the read side applies', () => {
    // Deliberate duplication across a package boundary that may not be crossed
    // (see org-slug.ts). This pins the shape so a change on one side shows up
    // as a failure rather than as a district that validates and never resolves.
    assert.equal(ORG_SLUG_PATTERN.source, '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$');
  });
});
