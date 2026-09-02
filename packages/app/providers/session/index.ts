export { SessionProvider, useAppSession, useSetContext } from './session';
export { authClient } from './live';
export { RoleSwitcher } from './role-switcher';
export { ContextSwitcher, roleNoun } from './context-switcher';
export { ScopeSwitcher } from './scope-switcher';
export type { AppSession, AppUser, ActiveContext, ActiveContextKind, Membership, RoleKind } from './types';
export {
  shellForRole,
  availableRoles,
  resolveBootRole,
  membershipForRole,
  SHELL_ROOTS,
  type Shell,
} from './shell';
export { getLastShellRole, setLastShellRole } from './last-shell';
