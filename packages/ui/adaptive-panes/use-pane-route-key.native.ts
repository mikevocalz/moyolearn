'use client';
// PLATFORM FORK — native. `NavigationRouteContext` is the screen's OWN route,
// provided by the navigator that mounted this subtree — stable across focus
// changes and identical for the screen's ShellHeader, which is what keys the
// pane-controls store. It defaults to undefined, so hosts mounted outside any
// navigator (Storybook, overlays) get null instead of a throw. Imported through
// expo-router deliberately: SDK 58 vendors its own react-navigation, and a
// context imported from `@react-navigation/core` would be a different object
// than the provider our navigators actually render.
// SOT-KEYWORDS: pane controls route key native fork react-navigation
import { useContext } from 'react';
import { NavigationRouteContext } from 'expo-router/react-navigation';

export function usePaneRouteKey(): string | null {
  return useContext(NavigationRouteContext)?.key ?? null;
}
