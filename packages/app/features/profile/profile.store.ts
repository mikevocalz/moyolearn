import { create } from 'zustand';
import { setThemePreference, type ThemePreference } from '@acme/theme/switch';

// Settings state — zustand always (repo rule).
//
// IDENTITY IS NOT HERE ANY MORE. This store used to own `name`, `handle`,
// `email` and a pinned DiceBear `AVATAR_URI`, seeded to an invented
// "Nina Alvarez". Every shell header on both platforms read them, so every
// signed-in person was drawn as her. Identity comes from the session now
// (`useIdentity`), which is the same rule the server side already holds:
// identity is never a parameter, it is read from context.
//
// What is left is preference, which is genuinely client-owned. `theme` is the
// only one that persists anything — `setThemePreference` writes it. The other
// three do not reach a server, which is recorded as a defect rather than
// hidden: see docs/design/reset/04-guardian-fixture-audit.md.
interface ProfileState {
  notifications: boolean;
  digest: boolean;
  publicProfile: boolean;
  theme: ThemePreference;
  setNotifications: (v: boolean) => void;
  setDigest: (v: boolean) => void;
  setPublicProfile: (v: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useProfile = create<ProfileState>((set) => ({
  notifications: true,
  digest: false,
  publicProfile: true,
  theme: 'system',
  setNotifications: (notifications) => set({ notifications }),
  setDigest: (digest) => set({ digest }),
  setPublicProfile: (publicProfile) => set({ publicProfile }),
  setTheme: (theme) => { setThemePreference(theme); set({ theme }); },
}));

export type { ThemePreference };
