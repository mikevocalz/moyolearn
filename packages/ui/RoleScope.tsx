'use client';
// One product, seven doors (doc 36 §5): re-points the SINGLE themed pair
// (--color-role-accent + its 24% underlay) at this door's hue for everything
// inside — the same custom-property scope mechanism as <Dial>, so both engines
// inherit it down the tree and slot components carry no role prop of their own.
// A slot writes `bg-role-accent-underlay` once; the shell decides the hue.
//
// Admin is deliberately not a role here: the back office earns no accent
// (doc 36 §5 — graphite ramp does the work), so an admin shell renders
// unwrapped. An unwrapped tree resolves the generic pair to the learner brand
// default, which is why admin surfaces must not use role-accent classes at
// all — tooling/check-role-accent.mjs holds that line.
//
// Like Dial, this is NOT layout-transparent: it renders a real View, so a
// RoleScope between a flex parent and a `flex-1` child needs `className="flex-1"`.
// Mobbin: https://mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2 (Speechify — accent confined to the raised primary tab, chrome stays neutral) · https://mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a (Skillshare — 4-tab bar, active state as tint not text recolour) · https://mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34 (Babbel — 3-tab bar, one accent moment). Structure only.
// SOT: docs/pack/36-role-navigation-flows.md §5 · packages/theme/tokens.ts `accentRoles`
// SOT-KEYWORDS: role scope accent shell door theme learner guardian tutor org district
import type { ReactNode } from 'react';
import type { AccentRole } from '@acme/theme';
import { View } from './primitives';

export interface RoleScopeProps {
  role: AccentRole;
  children: ReactNode;
  className?: string;
}

// Spelled out rather than templated: react-native-css resolves classes it can
// see, and a constructed `role-${role}` string is invisible to static
// extraction — the same reason Dial's SCOPE map exists.
const SCOPE: Record<AccentRole, string> = {
  learner: 'role-learner',
  guardian: 'role-guardian',
  tutor: 'role-tutor',
  teacher: 'role-teacher',
  org: 'role-org',
  school: 'role-school',
  district: 'role-district',
};

export function RoleScope({ role, children, className }: RoleScopeProps) {
  return <View className={`${SCOPE[role]}${className ? ` ${className}` : ''}`}>{children}</View>;
}
