// Native fetch has no browser cookie jar; use the Expo plugin's SecureStore session.
// SOT: https://better-auth.com/docs/integrations/expo#making-authenticated-requests-to-your-server
// SOT-KEYWORDS: session request fetch cookie credentials native securestore
import { authClient } from '../providers/session/live';
export async function sessionRequestOptions(): Promise<Pick<RequestInit, 'headers' | 'credentials'>> {
  return { headers: { Cookie: await authClient.getCookie() }, credentials: 'omit' };
}
