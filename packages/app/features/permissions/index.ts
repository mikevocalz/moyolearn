// The permissions feature's public surface.
//
// Everything platform-shaped is behind the `.native`/`.web` forks and reached
// through the anchor, so importing this from a browser bundle never names
// `react-native`.
// SOT: packages/app/features/permissions/permission-request.native.ts
// SOT-KEYWORDS: permissions index barrel checklist requester store

export { usePermissions } from './permissions.store.ts';
export { usePermissionRequester } from './permission-request';
export { PermissionChecklist } from './permission-checklist.tsx';
export {
  PERMISSION_KEYS,
  PERMISSION_COPY,
  canAsk,
  allGranted,
  type PermissionKey,
  type PermissionState,
  type PermissionCopy,
} from './permissions.types.ts';
export type { PermissionRequester } from './permission-request.types.ts';
