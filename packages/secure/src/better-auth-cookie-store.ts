// Web no-op for the Better Auth Expo cookie jar. Web sessions ride httpOnly
// cookies; nothing secret goes in localStorage, so a web build never calls this.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: better-auth cookie storage web no-op secure

export const betterAuthCookieStorage = {
  getItem: async () => null,
  getItemAsync: async () => null,
  setItem: async () => {},
  setItemAsync: async () => {},
  removeItem: async () => {},
};
