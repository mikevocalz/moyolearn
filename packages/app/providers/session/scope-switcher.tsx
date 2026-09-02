'use client';
// ScopeSwitcher — visible organization picker for institutional shells.
//
// District, school, and business hats often share one account: this dropdown
// makes the active tenant explicit and lets a user move between them without
// the avatar menu. It is a cousin of `ContextSwitcher` but scoped to the
// institutional roles that need a persistent workspace identity in the chrome.
// SOT: packages/app/providers/session/context-switcher.tsx
// SOT-KEYWORDS: scope switcher organization org district school business context menu

import { useMemo } from 'react';
import { Menu, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { ChevronDown } from '@acme/ui/icons';
import { useSessionStore } from './store';
import { setLastShellRole } from './last-shell';
import type { ActiveContextKind, Membership } from './types';

const INSTITUTIONAL_ROLES: readonly ActiveContextKind[] = [
  'owner',
  'staff',
  'school_admin',
  'district_admin',
];

function roleNoun(role: Membership['role']) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'staff':
      return 'Staff';
    case 'school_admin':
      return 'School admin';
    case 'district_admin':
      return 'District admin';
    default:
      return role;
  }
}

function labelFor(membership: Membership) {
  return `${membership.orgName} · ${roleNoun(membership.role)}`;
}

export function ScopeSwitcher() {
  const activeContext = useSessionStore((s) => s.activeContext);
  const memberships = useSessionStore((s) => s.memberships);
  const setContext = useSessionStore((s) => s.setContext);

  const scopes = useMemo(
    () => memberships.filter((m) => INSTITUTIONAL_ROLES.includes(m.role)),
    [memberships],
  );

  // Only draw in institutional shells; a tutor or teacher keeps the chrome
  // they already have and uses the avatar menu for any other hats.
  if (!INSTITUTIONAL_ROLES.includes(activeContext.kind)) return null;
  const activeScope = scopes.find(
    (m) => m.orgId === activeContext.orgId && m.role === activeContext.kind,
  );

  if (scopes.length === 0) return null;

  if (scopes.length === 1) {
    return (
      <View className="h-10 flex-row items-center px-2">
        <Text className="text-base font-semibold text-tenant-header-foreground">
          {activeScope?.orgName ?? scopes[0]!.orgName}
        </Text>
      </View>
    );
  }

  const actions = scopes.map((m) => ({
    id: m.id,
    title: labelFor(m),
    disabled: m.orgId === activeContext.orgId && m.role === activeContext.kind,
  }));

  return (
    <Menu
      title="Switch organization"
      actions={actions}
      onAction={(id) => {
        const membership = scopes.find((m) => m.id === id);
        if (!membership) return;
        setLastShellRole(membership.role);
        // E §3: spread-then-override so a switch never erases session context;
        // scopes are institutional-only, so no learnerId/gradeBand rides along.
        setContext({
          ...activeContext,
          kind: membership.role,
          orgId: membership.orgId,
          learnerId: undefined,
          gradeBand: undefined,
        });
      }}
    >
      <View className="h-10 flex-row cursor-pointer items-center gap-1 rounded-md px-2 hover:bg-tenant-surface-subtle">
        <Text className="text-base font-semibold text-tenant-header-foreground">
          {activeScope?.orgName ?? 'Select organization'}
        </Text>
        <ChevronDown className="h-4 w-4 text-tenant-header-muted" />
      </View>
    </Menu>
  );
}
