import { create } from 'zustand';
import { useAppSession, type ActiveContextKind } from '@acme/app';

// Role-scoped nav (doc 36 §3): one nav for everyone fails every role, so the
// header renders the ACTIVE role's IA. URLs stay put — deep links and
// notification links predate this split — only what the header shows changes.
// Anon keeps the marketing set.
// SOT: docs/pack/36-role-navigation-flows.md §3
// SOT-KEYWORDS: nav items role scoped header footer learner guardian tutor owner

export interface NavItem {
  label: string;
  href: string;
}

const MARKETING_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Explore', href: '/explore' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Notifications', href: '/notifications' },
];

/**
 * §3.1: the learner web nav is the same IA as the tabs — a Hot top-nav, no
 * sidebar, and the camera present as a first-class destination.
 */
const NAV_BY_ROLE: Record<ActiveContextKind, NavItem[]> = {
  anon: MARKETING_ITEMS,
  learner: [
    { label: 'Today', href: '/' },
    { label: 'Subjects', href: '/explore' },
    { label: 'Snap', href: '/capture' },
    { label: 'Progress', href: '/progress' },
  ],
  guardian: [
    { label: 'Home', href: '/' },
    { label: 'Reports', href: '/reports' },
    { label: 'Alerts', href: '/notifications' },
    { label: 'Family', href: '/settings' },
  ],
  tutor: [
    { label: 'Today', href: '/' },
    { label: 'Learners', href: '/session-prep' },
    { label: 'Notes', href: '/report-queue' },
    { label: 'Schedule', href: '/schedule' },
  ],
  teacher: [
    { label: 'Today', href: '/' },
    { label: 'Learners', href: '/session-prep' },
    { label: 'Notes', href: '/report-queue' },
    { label: 'Schedule', href: '/schedule' },
  ],
  owner: [
    { label: 'Overview', href: '/ops' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Reports', href: '/reports' },
  ],
  staff: [
    { label: 'Today', href: '/' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Clients', href: '/ops' },
    { label: 'Inbox', href: '/notifications' },
  ],
  school_admin: [
    { label: 'Overview', href: '/' },
    { label: 'Academics', href: '/academics' },
    { label: 'People', href: '/people' },
    { label: 'Reports', href: '/reports' },
  ],
  district_admin: [
    { label: 'Outcomes', href: '/' },
    { label: 'Schools', href: '/schools' },
    { label: 'People', href: '/people' },
    { label: 'Reports', href: '/reports' },
  ],
};

export function useNavItems(): NavItem[] {
  const { activeContext } = useAppSession();
  return NAV_BY_ROLE[activeContext.kind];
}

// Profile (with settings inside) gets the avatar slot, not a text link.
export const PROFILE = { label: 'Profile', href: '/profile' } as const;

// Menu state — zustand always (repo rule).
export const useMobileMenu = create<{ open: boolean; toggle: () => void; close: () => void }>(
  (set) => ({
    open: false,
    toggle: () => set((s) => ({ open: !s.open })),
    close: () => set({ open: false }),
  }),
);
