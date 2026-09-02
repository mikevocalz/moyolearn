// /calendar — the family calendar. The dir was renamed from `family-calendar`
// (the smaller correct change vs. forking the pushed href): FamilyScreen and
// the guardian home push the shared `/calendar`, which is also where the
// mobile guardian shell mounts its calendar stack route — one path, both
// platforms. Route groups don't affect URLs, and nothing else serves /calendar.
// SOT: packages/app/features/home/family-screen.tsx · apps/mobile/app/(guardian)/calendar.tsx
// SOT-KEYWORDS: family calendar page web route guardian
import { FamilyCalendarScreen } from '@acme/app';

export default FamilyCalendarScreen;
