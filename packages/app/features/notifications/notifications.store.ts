// The org Inbox's item store — org-scoped items only, each carrying the exit
// where it is HANDLED (org.inbox contract: "an item with no action target is a
// dead end and may not ship"). The liquid-glass template feed this replaced
// ("New follower", "Order shipped", a $149 invoice) belonged to another
// product; rendering it as an org's inbox presented demo copy as business
// truth. Server wiring is still the contract's [add] — until it lands these
// are seeded dev-persona items shaped like the real inbound kinds (reschedule
// requests → schedule, lead replies → CRM), never platform notices.
//
// DECISION — no incident-shaped item may ever be seeded or wired here:
// doc 31's channel is org.safety exclusively (contract Notes: "an
// incident-shaped item appearing in the inbox is a contract violation").
// The old "Security alert" Shield row is gone for exactly that reason.
// SOT: design/screens/org/org.inbox/contract.md · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: org inbox notifications store items exit target schedule crm zustand
import { create } from 'zustand';
import { Calendar, MessageCircle, UserPlus } from '@acme/ui/icons';
import { leadsRootPath } from '../ops';

export interface Notification {
  id: string;
  title: string;
  body: string;
  /** Real timestamp (epoch ms) — grouping and relative labels derive from it,
   * never from a hand-written "2m ago" string or a list position. */
  at: number;
  /** The exit where this item is handled — REQUIRED, so an actionless item is
   * unrepresentable (org.inbox law). */
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'primary' | 'accent' | 'gold';
  read: boolean;
}

// Seed offsets are real timestamps against boot so the Today/Earlier split is
// computed from dates, not faked from index positions.
const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/*
  Exit targets ride the ops-paths fork where the platforms differ: the CRM is
  web-first, so `leadsRootPath()` is /leads on web and the Overview tab on
  mobile (a real surface, never a 404). /schedule exists on both. No
  billing_notice item is seeded: its contract exit is org.money, which is
  STRUCK — an item whose door leads nowhere may not ship.
*/
const SEED: Notification[] = [
  { id: '1', title: 'Reschedule request', body: 'The Chen family asked to move Thursday 4:00pm', at: NOW - 18 * MINUTE, href: '/schedule', icon: Calendar, tone: 'accent', read: false },
  { id: '2', title: 'Lead replied', body: 'The Alvarez family answered your trial follow-up', at: NOW - 1 * HOUR, href: leadsRootPath(), icon: MessageCircle, tone: 'primary', read: false },
  { id: '3', title: 'New inquiry', body: 'The Okafor family asked about Science tutoring', at: NOW - 1 * DAY, href: leadsRootPath(), icon: UserPlus, tone: 'gold', read: true },
];

// Notification state — zustand always (repo rule).
export const useNotifications = create<{
  items: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}>((set) => ({
  items: SEED,
  markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
}));
