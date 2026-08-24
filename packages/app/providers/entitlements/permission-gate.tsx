'use client';
// PermissionGate — doc 06 §4 names it as the thing entitlements feed. One
// capability in, children or a fallback out.
//
// Mobbin: not applicable — this renders no surface of its own. It shows the
// children it is given, or the `fallback` a caller supplies; every screen it
// gates carries its own references.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · CLAUDE.md (Children's surfaces)
// SOT-KEYWORDS: permission gate entitlement capability paywall learner upgrade

import type { ReactNode } from 'react';
import type { Capability } from '@acme/auth';
import { useAppSession } from '../session';
import { useEntitlements } from './use-entitlements';

export interface PermissionGateProps {
  capability: Capability;
  children: ReactNode;
  /** What to show instead. Omit and a blocked capability renders nothing. */
  fallback?: ReactNode;
  /**
   * What to show while the webhook truth is still in flight. Defaults to the
   * children: a paying customer must never see an upsell for a beat because the
   * network was slow, and the server enforces the real boundary anyway.
   */
  pending?: ReactNode;
}

export function PermissionGate({ capability, children, fallback, pending }: PermissionGateProps) {
  const { can, loaded } = useEntitlements();
  const { activeContext } = useAppSession();

  if (!loaded) return <>{pending ?? children}</>;
  if (can(capability)) return <>{children}</>;

  // CLAUDE.md: no paywall, price, or upgrade prompt may render on a learner
  // surface. Ever. A fallback is a caller's argument, so this is the only place
  // that can refuse to render one on the child's side of the app.
  if (activeContext.kind === 'learner') return null;

  return <>{fallback ?? null}</>;
}
