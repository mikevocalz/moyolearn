// Better Auth client for the web app.
// SOT: docs/pack/06-auth-onboarding-spec.md §10
// SOT-KEYWORDS: auth client better-auth web baseURL
import { createMoyoAuthClient } from '@acme/auth';

export const authClient = createMoyoAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
});
