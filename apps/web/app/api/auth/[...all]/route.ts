// Better Auth catch-all handler.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: auth api catch-all better-auth handler route
import { auth } from '@/lib/auth';

export const GET = auth.handler;
export const POST = auth.handler;
export const PUT = auth.handler;
export const DELETE = auth.handler;
export const PATCH = auth.handler;
