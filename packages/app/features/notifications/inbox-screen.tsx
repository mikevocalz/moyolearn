// Org Inbox — a thin composition over the shared notifications surface.
// The title prop is the only difference from the guardian Notifications view.
// SOT: packages/app/features/notifications/screen
// SOT-KEYWORDS: org inbox notifications title composition
import { NotificationsScreen } from './screen';

export function InboxScreen() {
  return <NotificationsScreen title="Inbox" />;
}
