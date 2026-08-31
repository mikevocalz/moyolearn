// Institution permission policy — pure, server-authoritative decisions.
//
// These functions answer the question: in a given tenant scope, what may this
// education role do? The inputs are the role and the resource/action; the
// service is responsible for proving the caller's role and the tenant scope.
// The policy does not touch the database and is testable without one.
// SOT: packages/app/providers/session/role-mapping.ts · packages/app/core/membership-gate.ts
// SOT-KEYWORDS: institution permission policy can allowed role scope resource action

import type { RoleKind } from '../../providers/session/types.ts';
import type { InstitutionAction, InstitutionResource, InstitutionScope } from './institution.types.ts';

export class InstitutionPermissionDenied extends Error {
  readonly status = 403;
  readonly role: RoleKind;
  readonly scope: InstitutionScope;
  readonly resource: InstitutionResource;
  readonly action: InstitutionAction;

  constructor(role: RoleKind, scope: InstitutionScope, resource: InstitutionResource, action: InstitutionAction) {
    super(`This operation requires ${action} on ${resource} in ${scope}.`);
    this.name = 'InstitutionPermissionDenied';
    this.role = role;
    this.scope = scope;
    this.resource = resource;
    this.action = action;
  }
}

type ActionSet = readonly InstitutionAction[];

type ResourceGrants = Partial<Record<InstitutionResource, ActionSet>>;

/**
 * The canonical grant matrix. A missing cell means no actions are allowed.
 *
 * `manage` is granted explicitly and does NOT imply `view` in this table; the
 * helpers below add that implication for the public `can` function, but the raw
 * table stays an exact list of what the role is trusted with.
 */
const GRANTS: Record<RoleKind, Partial<Record<InstitutionScope, ResourceGrants>>> = {
  learner: {},
  guardian: {},
  tutor: {},
  teacher: {},
  owner: {
    own_org: {
      people: ['view', 'manage', 'invite', 'delete'],
      programs: ['view', 'manage'],
      reports: ['view', 'manage'],
      billing: ['view', 'manage'],
      settings: ['view', 'manage'],
      tenant: ['view', 'manage'],
    },
  },
  staff: {
    own_org: {
      people: ['view'],
      programs: ['view', 'manage'],
      reports: ['view'],
      settings: ['view'],
      tenant: ['view'],
    },
  },
  school_admin: {
    school: {
      people: ['view', 'manage', 'invite', 'delete'],
      schools: ['view'],
      programs: ['view', 'manage'],
      reports: ['view'],
      settings: ['view', 'manage'],
      tenant: ['view'],
    },
  },
  district_admin: {
    district: {
      people: ['view', 'manage', 'invite'],
      schools: ['view', 'manage', 'invite'],
      programs: ['view', 'manage'],
      reports: ['view'],
      settings: ['view', 'manage'],
      tenant: ['view', 'manage'],
    },
  },
};

function impliedActions(actions: ActionSet): ActionSet {
  const out: InstitutionAction[] = [...actions];
  if (actions.includes('manage')) {
    out.push('view');
  }
  return out as ActionSet;
}

export function allowedActions(
  role: RoleKind,
  scope: InstitutionScope,
  resource: InstitutionResource,
): readonly InstitutionAction[] {
  const cell = GRANTS[role]?.[scope]?.[resource];
  if (!cell) return [];
  return [...new Set(impliedActions(cell))];
}

export function can(
  role: RoleKind,
  scope: InstitutionScope,
  resource: InstitutionResource,
  action: InstitutionAction,
): boolean {
  return allowedActions(role, scope, resource).includes(action);
}

export function requirePermission<R>(
  role: RoleKind,
  scope: InstitutionScope,
  resource: InstitutionResource,
  action: InstitutionAction,
  operation: () => R,
): R {
  if (!can(role, scope, resource, action)) {
    throw new InstitutionPermissionDenied(role, scope, resource, action);
  }
  return operation();
}
