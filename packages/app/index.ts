// @acme/app — universal business/domain logic and shared screens.
// Screens live in features/* (Solito pattern); add domains alongside them.
// A feature that owns an index.ts is re-exported through it, never past it —
// deep paths make the sub-barrel invisible to search, which is how duplicates start.
// SOT: CLAUDE.md ("Features import a domain's index.ts — never a deep path")
// SOT-KEYWORDS: app package index barrel public-api screens features
export { HomeScreen } from './features/home/screen';
export { ExploreScreen } from './features/explore/screen';
export { NotificationsScreen } from './features/notifications/screen';
export { ProfileScreen } from './features/profile/screen';
export { SettingsScreen } from './features/settings/screen';
export { useProfile, AVATAR_URI, type ThemePreference } from './features/profile/profile.store';
export { ScheduleScreen } from './features/schedule/screen';
export { MenuButton } from './features/home/menu-button';
export {
  DEMO_RESOURCES,
  DEMO_DAY,
  DEMO_NOW,
  useScheduleStore,
  MiniCalendar,
  BookingForm,
  type BookingFormProps,
  formatTimeRange,
  type ScheduleEvent,
  type Resource,
} from './features/schedule';
export { CaptureScreen, useCaptureStore } from './features/capture';
export { TutorScreen } from './features/tutor/screen';
export { ErrorScreen } from './features/error/screen';
export { AppQueryProvider, createQueryClient } from './providers/query-provider';
export { SafeAreaProvider } from './providers/safe-area';
export * from './features/editor';
