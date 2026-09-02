// The per-shell tab bar. One component, config-driven, so all four role shells
// share the slab visual language (2px ink border, hard offset shadow) while
// each shell declares only its items — doc 36 §5's "one product, different
// door" as a component contract.
//
// The raised center slot (learner Snap) follows Speechify's raised
// primary-action tab; targets scale from the age-band token so a K–2 thumb gets
// the NN/g 2cm circle, not an adult 44.
//
// Role accent: the focused underlay consumes `bg-role-accent-underlay` BY NAME
// (doc 36 §5 allowlist: "active tab/nav indicator underlay"). PR-141 owns the
// token; until it lands the class is inert and the ink border + label weight
// carry selection alone — which is also the doc 08 §4.9 fallback.
//
// Mobbin: Speechify raised center tab (mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2) ·
// Quizlet 4-tab bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway 4-tab bar (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17)
// SOT: docs/pack/36-role-navigation-flows.md §3 §5 · docs/pack/08-visual-hierarchy-spacing-spec.md §4.9
// SOT-KEYWORDS: shell tab bar role raised center camera band target slab rail

// expo-router's `react-navigation` entry does not re-export the bottom-tabs
// types, so this reaches the module that declares them.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ComponentType } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@acme/ui/tw';
import { haptics } from '@acme/ui/haptics';

export interface ShellTabItem {
  /** The route name inside the shell's (tabs) group. */
  name: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  /** The Speechify slot: rendered as a raised circular slab. At most one. */
  raised?: boolean;
}

interface ShellTabBarProps extends BottomTabBarProps {
  items: ShellTabItem[];
  /**
   * Hot shells pass the learner's band so item height and the raised circle
   * clear the band's target token; Cool shells omit it and get the adult 44.
   */
  targetClass?: string;
  /**
   * Learner shell only: selection is a primary FILL (doc 08 §4.9 — "fills are
   * for the child's world"). Every other shell gets the sunken slab + accent
   * pip, because §5 allows the role accent as an indicator underlay, never as
   * a field the whole item sits on.
   */
  fillActive?: boolean;
}

export function ShellTabBar({ state, navigation, items, targetClass, fillActive }: ShellTabBarProps) {
  const insets = useSafeAreaInsets();
  const minTarget = targetClass ?? 'min-h-target-adult';

  const rendered = items.map((item) => {
    const index = state.routes.findIndex((route) => route.name === item.name);
    if (index === -1) {
      // The silent skip once shipped a 1-of-5 tab bar (G §1.8 · ADR-101):
      // dev fails loud; production keeps the safe skip so a bad ITEMS entry
      // degrades a shell instead of crashing it.
      if (__DEV__) {
        console.error(
          `ShellTabBar: ITEMS entry "${item.name}" has no route file in this (tabs) group — the tab is silently dropped. Add the route file or remove the entry.`,
        );
      }
      return null;
    }
    const route = state.routes[index]!;
    const focused = state.index === index;

    const onPress = () => {
      haptics.selection();
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    if (item.raised) {
      return (
        <Pressable
          key={route.key}
          aria-label={item.label}
          aria-selected={focused}
          onPress={onPress}
          className="flex-1 items-center"
        >
          {/* Raised above the bar's top edge: the product's signature action is
              physically the biggest, highest thing on the bar on every band. */}
          <View className="-mt-8 items-center gap-0.5">
            <View
              className={`h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-action-primary shadow-card ${
                focused ? '' : 'active:opacity-80'
              }`}
            >
              <item.Icon size={30} className="text-on-action" />
            </View>
            <Text numberOfLines={1} className="text-xs font-semibold text-text">
              {item.label}
            </Text>
          </View>
        </Pressable>
      );
    }

    /*
      §5's one sanctioned indicator: the ACTIVE item sits on the role-accent
      UNDERLAY (24%), hue supplied by the shell's RoleScope. The learner shell
      keeps its full primary fill instead — highlighter is that shell's accent
      and doc 08 §4.9 reserves solid fills for the child's world.
    */
    const focusedSlab = fillActive
      ? 'border-border bg-action-primary shadow-card'
      : 'border-border bg-role-accent-underlay shadow-card';
    const focusedText = fillActive ? 'text-on-action' : 'text-text';

    return (
      <Pressable key={route.key} aria-label={item.label} aria-selected={focused} onPress={onPress} className="flex-1">
        {/* Unselected keeps a transparent border so selection never shifts
            layout by the border's width. */}
        <View
          className={`items-center justify-center gap-0.5 rounded-md border-2 px-1 py-1.5 ${minTarget} ${
            focused ? focusedSlab : 'border-transparent hover:bg-surface-sunken'
          }`}
        >
          <item.Icon size={24} className={focused ? focusedText : 'text-text-muted'} />
          <Text
            numberOfLines={1}
            className={`text-xs ${focused ? `font-bold ${focusedText}` : 'font-semibold text-text-muted'}`}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  });

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="flex-row items-end gap-1 border-t-2 border-border bg-surface-footer px-2 pt-1"
    >
      {rendered}
    </View>
  );
}
