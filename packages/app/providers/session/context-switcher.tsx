// ContextSwitcher — one human, several hats (S15).
// Memberships are auth-level, not UI sugar: switching rewrites `activeContext`,
// which is what the shell, the dial, and the guard tree all read.
// SOT: docs/pack/04-screen-briefs.md §S15
// SOT-KEYWORDS: context switcher membership hat org role active context multi-role

import { Check } from '@acme/ui/icons';
import { Text } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import { useSessionStore } from './store';
import { setLastShellRole } from './last-shell';
import type { ActiveContextKind, Membership } from './types';

/**
 * Entries read as human names for hats, not as database rows: a guardian
 * membership on the family org is "Maya's parent", never "home · guardian".
 */
function labelFor(membership: Membership) {
  if (membership.role === 'guardian') return membership.orgName;
  return `${membership.orgName} · ${roleNoun(membership.role)}`;
}

/** Exported for the AccountSheet's identity header (ADR-106) — one noun table, not two. */
export function roleNoun(role: Membership['role']) {
  switch (role) {
    case 'tutor':
      return 'Tutor';
    case 'teacher':
      return 'Teacher';
    case 'owner':
      return 'Owner';
    case 'staff':
      return 'Staff';
    case 'school_admin':
      return 'School admin';
    case 'district_admin':
      return 'District admin';
    case 'guardian':
      return 'Parent';
    default:
      return 'Learner';
  }
}

export function ContextSwitcher() {
  const memberships = useSessionStore((s) => s.memberships);
  const activeContext = useSessionStore((s) => s.activeContext);
  const setContext = useSessionStore((s) => s.setContext);

  // A single hat is not a choice — rendering a one-item picker is noise.
  if (memberships.length < 2) return null;

  return (
    <View className="gap-stack p-inset">
      <Text className="font-sans text-caption text-text-muted">Switch context</Text>
      <View className="gap-element">
        {memberships.map((membership) => {
          const active = activeContext.orgId === membership.orgId;
          return (
            <Pressable
              key={membership.id}
              aria-label={labelFor(membership)}
              aria-selected={active}
              onPress={() => {
                // Doc 36 §2: "n roles → last-used shell". The memory is written
                // at the moment of choice, so the next cold start opens the
                // door this person walked through last.
                setLastShellRole(membership.role);
                setContext({
                  kind: membership.role as ActiveContextKind,
                  orgId: membership.orgId,
                });
              }}
              className={`min-h-11 flex-row items-center gap-stack rounded-md border-2 px-3 py-2.5 ${
                active
                  ? 'border-border bg-primary shadow-card'
                  : 'border-transparent hover:bg-surface-sunken'
              }`}
            >
              <Text className={`flex-1 text-base ${active ? 'font-semibold text-on-primary' : 'text-text'}`}>
                {labelFor(membership)}
              </Text>
              {active ? <Check size={16} className="text-on-primary" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
