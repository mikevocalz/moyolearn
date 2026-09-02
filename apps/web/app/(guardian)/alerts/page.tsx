// /alerts — guardian.alerts: incidents + acknowledgments, never general
// notifications (the nav's Alerts item used to point at /notifications,
// which is the contract's named defect: Alerts ≠ Messages/Notifications,
// doc 36 §3.2). Same path the mobile Alerts tab answers.
// SOT: packages/app/features/safety/guardian-alerts-content.tsx · design/screens/guardian/guardian.alerts/contract.md
// SOT-KEYWORDS: guardian alerts page web route incidents acknowledge
import type { Metadata } from 'next';
import { GuardianAlertsScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Alerts — Moyo',
  description: 'Incidents that need your attention, and their acknowledgments.',
};

export default function GuardianAlertsPage() {
  return <GuardianAlertsScreen />;
}
