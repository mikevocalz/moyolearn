'use client';

import { HomeScreen } from '@acme/app';

// Thin route wrapper — the screen lives in packages/app/features (Solito pattern).
export default function HomePage() {
  return <HomeScreen />;
}
