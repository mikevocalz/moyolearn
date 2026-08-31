import { redirect } from 'next/navigation';

// The business shell lives at `/ops`; this canonical route redirects there so
// existing deep links and the ops DashboardShell stay the source of truth.
export default function BusinessOverviewPage() {
  redirect('/ops');
}
