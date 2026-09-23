// Stripe web identity is supplied by the server session at checkout; no mobile
// SDK is loaded into the web bundle.
// SOT: packages/auth/src/server.ts
// SOT-KEYWORDS: billing identity web platform fork
export function PurchaseIdentity() { return null; }
