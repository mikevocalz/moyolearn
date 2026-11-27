// PLATFORM FORK — the SecureStore session cookie the Expo plugin keeps, read
// through the auth client's own `getCookie()` so the storage key and cookie
// format stay the plugin's business. See core/api-session.ts.
// SOT: packages/app/core/api-session.ts · packages/auth/src/expo-plugin.native.ts
// SOT-KEYWORDS: session cookie source native secure store expo platform fork
import type { SessionCookieSource } from '../../core/api-session.ts';
import { authClient } from './live';

export const sessionCookieSource: SessionCookieSource | null = {
  getCookie: () => authClient.getCookie(),
};
