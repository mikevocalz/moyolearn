// Web (and the TS resolution anchor): no session cookie source. The browser
// attaches the httpOnly session cookie itself; see core/api-session.ts.
// SOT: packages/app/core/api-session.ts
// SOT-KEYWORDS: session cookie source web platform fork
import type { SessionCookieSource } from '../../core/api-session.ts';

export const sessionCookieSource: SessionCookieSource | null = null;
