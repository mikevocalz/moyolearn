import type { ExpoPlugins } from './expo-plugin.types.ts';

/**
 * Nothing. `@better-auth/expo/client` statically requires `expo-network`, which
 * has no web build — importing it anywhere reachable from the browser graph
 * fails the Next build outright, so the plugin cannot merely be left unused, it
 * has to be un-imported. This fork is what makes that true.
 */
export const expoPlugins: ExpoPlugins = () => [];
