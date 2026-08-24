// @acme/auth/client — the Better Auth client, plugin roster mirrored from the
// server so inference matches on both platforms.
// SOT: docs/pack/06-auth-onboarding-spec.md §10
// SOT-KEYWORDS: auth client better-auth expo session plugins

import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { multiSessionClient, organizationClient, usernameClient } from 'better-auth/client/plugins';

export function createMoyoAuthClient(options: {
  baseURL: string;
  /** Native only — the SecureStore-backed cookie jar the Expo plugin writes to. */
  storage?: Parameters<typeof expoClient>[0]['storage'];
  scheme?: string;
}) {
  return createAuthClient({
    baseURL: options.baseURL,
    plugins: [
      usernameClient(),
      organizationClient(),
      multiSessionClient(),
      ...(options.storage
        ? [expoClient({ scheme: options.scheme ?? 'moyo', storage: options.storage })]
        : []),
    ],
  });
}

export type MoyoAuthClient = ReturnType<typeof createMoyoAuthClient>;
