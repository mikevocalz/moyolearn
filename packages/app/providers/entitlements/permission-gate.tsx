'use client';
// PermissionGate — doc 06 §4 names it as the thing entitlements feed. One
// capability in, children or a fallback out.
//
// It decides what a screen SHOWS. It is not a boundary: the operation behind the
// feature is refused independently by `core/capability-gate.ts`, so a client
// that lies, lags, or never loads changes what a person sees and never what they
// can do. The unloaded default and its reasoning live in `gate-decision.ts`.
//
// Mobbin: not applicable — this renders no surface of its own. It shows the
// children it is given, or the `fallback` a caller supplies; every screen it
// gates carries its own references.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · CLAUDE.md (Children's surfaces)
// SOT-KEYWORDS: permission gate entitlement capability paywall learner upgrade

import type { ReactNode } from 'react';
import type { Capability } from '@acme/auth';
import { useAppSession } from '../session';
import { gateDecision } from './gate-decision';
import { useEntitlements } from './use-entitlements';

export interface PermissionGateProps {
  capability: Capability;
  children: ReactNode;
  /** What to show instead. Omit and a blocked capability renders nothing. */
  fallback?: ReactNode;
  /**
   * A NEUTRAL placeholder for the beat before entitlement truth arrives — a
   * skeleton, not an offer. It is a separate prop from `fallback` because the
   * two answer different questions ("still checking" vs "your plan does not
   * include this"), and only one of them may carry an upgrade prompt.
   */
  pending?: ReactNode;
}

export function PermissionGate({ capability, children, fallback, pending }: PermissionGateProps) {
  const { can, loaded } = useEntitlements();
  const { activeContext } = useAppSession();

  switch (
    gateDecision({
      loaded,
      allowed: can(capability),
      contextKind: activeContext.kind,
      hasPending: pending !== undefined,
    })
  ) {
    case 'children':
      return <>{children}</>;
    case 'pending':
      return <>{pending}</>;
    case 'fallback':
      return <>{fallback ?? null}</>;
    case 'nothing':
      return null;
  }
}
