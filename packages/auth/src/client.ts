// @acme/auth/client — the Better Auth client, plugin roster mirrored from the
// server so inference matches on both platforms. The Expo plugin arrives through
// a platform fork (expo-plugin.*) because `@better-auth/expo/client` statically
// requires `expo-network`: importing it here would break the web build even when
// the plugin goes unused.
// SOT: docs/pack/06-auth-onboarding-spec.md §10
// SOT-KEYWORDS: auth client better-auth expo session plugins

import { createAuthClient } from 'better-auth/react';
import type { createAuth } from './server.ts';
import {
  multiSessionClient,
  organizationClient,
  usernameClient,
  inferOrgAdditionalFields,
} from 'better-auth/client/plugins';
import { expoPlugins } from './expo-plugin';

type MoyoAuthServer = ReturnType<typeof createAuth>;

export function createMoyoAuthClient(options: {
  baseURL: string;
  /** Native only — the SecureStore-backed cookie jar the Expo plugin writes to. */
  storage?: unknown;
  scheme?: string;
}) {
  return createAuthClient({
    baseURL: options.baseURL,
    plugins: [
      usernameClient(),
      organizationClient({ schema: inferOrgAdditionalFields<MoyoAuthServer>() }),
      multiSessionClient(),
      ...expoPlugins({ storage: options.storage, scheme: options.scheme }),
    ],
  });
}

export type MoyoAuthClient = ReturnType<typeof createMoyoAuthClient>;
