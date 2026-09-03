// The same `ShellHeader`, for the routes that live OUTSIDE the shell groups.
//
// `/settings`, `/editor-settings` and the dev hatch are root children because
// several shells push them and expo-router forbids one path living in two
// sibling groups. The cost of that was chrome: the root layout rendered a bare
// `<Slot>`, so those screens arrived with no app bar, no title and no way back
// except the hardware gesture — the single loudest "am I still in the same app?"
// moment in the product, and it sat one tap from every shell's avatar.
//
// The only thing this adds over `ShellHeader` is the door. `RoleScope` re-points
// `--color-surface-header` and its ink per role, and the shells each wrap their
// own navigator in one; a root-level route has no shell above it, so the bar
// would fall back to the learner default and a guardian pushing Settings would
// watch the header change colour mid-journey. Reading the active context here
// keeps the door constant across the push.
// SOT: docs/pack/36-role-navigation-flows.md §5 · ./ShellHeader.tsx
// SOT-KEYWORDS: root header shell header settings editor-settings role scope door chrome

import { RoleScope } from '@acme/ui';
import { shellForRole, useAppSession } from '@acme/app';
import { ShellHeader, type ShellHeaderProps } from './ShellHeader';

export function RootHeader(props: ShellHeaderProps) {
  const { activeContext } = useAppSession();
  // `anon` resolves to no shell; the learner door is the brand default the
  // unscoped tokens already carry, so pre-auth chrome does not change colour.
  const role = shellForRole(activeContext.kind) ?? 'learner';

  return (
    <RoleScope role={role}>
      <ShellHeader {...props} />
    </RoleScope>
  );
}
