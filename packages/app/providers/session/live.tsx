// LiveSessionProvider — Wave-3 auth integration (Better Auth) lives here.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: live session provider better auth wave3

import { useEffect } from 'react';
import { useSessionStore } from './store';

export function LiveSessionProvider({ children }: { children: React.ReactNode }) {
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(true);
    // Wave 3: mount Better Auth client and resolve session.
  }, [setLoading]);

  return <>{children}</>;
}
