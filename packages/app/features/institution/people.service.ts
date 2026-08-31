import 'server-only';
// Organization people service — server-authoritative list of members.
//
// The permission gate is `district/people/view` or `school/people/view` depending
// on the resolved organization kind. The repository lives in the web app and
// reads the Better Auth `member` and `user` tables.
// SOT: packages/auth/src/membership.ts · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: institution people service members protected operation

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { LoadOrgBranding, OrgBranding } from '../org/org.service.ts';
import type { OrgMember } from './people.types.ts';

/** Repository port — the caller provides the auth adapter. */
export type LoadOrgMembers = (orgId: string) => Promise<OrgMember[]>;

export interface OrgPeople {
  /** The current tenant branding. */
  org: OrgBranding | null;
  /** The members of this organization. */
  members: OrgMember[];
}

/**
 * Loads the people in the current organization.
 *
 * Returns the tenant branding plus the member list so the list screen can render
 * both the co-branded header and the member rows in one request.
 */
export async function loadOrgPeople(
  loadOrgBranding: LoadOrgBranding,
  loadOrgMembers: LoadOrgMembers,
  authInstance: Auth,
  headers: Headers,
  kind: 'district' | 'school',
): Promise<OrgPeople> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const orgId = ctx.orgId ?? '';
      const [org, members] = await Promise.all([
        loadOrgBranding(orgId),
        loadOrgMembers(orgId),
      ]);
      return { org, members };
    },
    {
      requires: 'practise',
      requiresInstitution: { scope: kind, resource: 'people', action: 'view' },
    },
  );
}
