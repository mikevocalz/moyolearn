// Web requests use the browser's httpOnly session cookie.
// SOT: https://better-auth.com/docs/integrations/expo
// SOT-KEYWORDS: session request fetch cookie credentials web
export async function sessionRequestOptions(): Promise<Pick<RequestInit, 'headers' | 'credentials'>> {
  return { credentials: 'include' };
}
