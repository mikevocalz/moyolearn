import { expoClient } from '@better-auth/expo/client';
import type { ExpoPlugins } from './expo-plugin.types.ts';

/**
 * Doc 06 §10 adopts `@better-auth/expo` for the SecureStore-backed cookie jar and
 * the scheme-based session hand-off. Without `storage` there is nothing for it to
 * write to, so the plugin is left out rather than half-configured.
 */
export const expoPlugins: ExpoPlugins = ({ storage, scheme }) =>
  storage
    ? [
        expoClient({
          scheme: scheme ?? 'moyo',
          storage: storage as Parameters<typeof expoClient>[0]['storage'],
        }),
      ]
    : [];
