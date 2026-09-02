'use client';
// ChildSwitcher — the guardian's child-selection chip row (doc 36 §3.2:
// "Multi-child: child-switcher chips on Home, never separate logins").
//
// Pure composition over `Avatar` + `Text` + `PressScale` — no new ui primitive;
// if a second chip-row consumer ever appears, promote then (ui-promotions
// trigger). Reads and writes `family.store` ONLY (J §2 row 10 state law), so
// every per-child guardian surface — home, reports, calendar, ai-activity —
// scopes to the same child through one seam.
//
// One child renders nothing: a picker with no alternative is noise — the same
// rule ContextSwitcher applies to a single membership. Overflow scrolls
// horizontally rather than wrapping so the row stays one visual line of chips.
// SOT: docs/design/overhaul-v2/J-component-plan.md §2 row 10 · docs/pack/36-role-navigation-flows.md §3.2 · design/screens/guardian/guardian.home/contract.md
// SOT-KEYWORDS: child switcher chips guardian family store active child g-8 avatar press scale

import { Avatar, PressScale } from '@acme/ui';
import { ScrollView, Text as TWText } from '@acme/ui/tw';
import { useFamilyStore } from './family.store';

export function ChildSwitcher() {
  const children = useFamilyStore((s) => s.children);
  const selectedLearnerId = useFamilyStore((s) => s.selectedLearnerId);
  const selectLearner = useFamilyStore((s) => s.selectLearner);

  if (children.length < 2) return null;

  const activeId = selectedLearnerId ?? children[0]?.id;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-element"
    >
      {children.map((child) => {
        const active = child.id === activeId;
        return (
          <PressScale
            key={child.id}
            onPress={() => selectLearner(child.id)}
            aria-label={child.name}
            aria-selected={active}
            className={`min-h-11 flex-row items-center gap-element rounded-card border-2 px-3 py-2 ${
              active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
            }`}
          >
            <Avatar name={child.name} size="sm" />
            <TWText className={active ? 'font-semibold text-on-primary' : 'text-text'}>
              {child.name}
            </TWText>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}
