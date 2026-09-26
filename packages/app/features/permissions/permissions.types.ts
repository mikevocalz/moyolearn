// What the app asks the OS for, and what the OS said — platform-neutral.
//
// A SEPARATE FILE BECAUSE THE CHECKLIST IS SHARED AND THE REQUESTER IS NOT.
// `permission-request.native.ts` names `react-native` and `PermissionsAndroid`;
// the checklist surface and the store must not, or a browser bundle resolves a
// module that only exists on a device.
// SOT: packages/app/features/permissions/permission-request.native.ts
// SOT-KEYWORDS: permissions types checklist microphone camera photos state platform neutral

/**
 * The permissions this app actually uses. Adding one here is a promise that
 * something in the product reads it — an entry with no consumer is a dialog a
 * child's guardian is asked to answer for nothing.
 */
export const PERMISSION_KEYS = ['microphone', 'camera', 'photos'] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * What the OS said, as four states rather than a boolean.
 *
 * `undetermined` is load-bearing and is NOT a synonym for denied: it is the
 * honest answer when this code never obtained a grant — an iOS permission the
 * OS raises itself at first capture, or a key nobody has been asked about yet.
 * Recording those as granted would be a claim, and recording them as denied
 * would send a child to a Settings page that has nothing wrong on it.
 *
 * `blocked` is denied-and-do-not-ask-again. The OS silently ignores further
 * requests, so the only route left is the app's own settings page — which is
 * why the checklist has to be able to tell the two denials apart.
 */
export type PermissionState = 'granted' | 'denied' | 'blocked' | 'undetermined';

/** One row of the checklist: what it is for, in words a guardian can act on. */
export interface PermissionCopy {
  title: string;
  /** Why the app wants it. Concrete — never "to improve your experience". */
  reason: string;
}

export const PERMISSION_COPY: Record<PermissionKey, PermissionCopy> = {
  microphone: {
    title: 'Microphone',
    reason: 'So your learner can talk to their tutor instead of typing.',
  },
  camera: {
    title: 'Camera',
    reason: 'So they can photograph a worksheet and get help with it.',
  },
  photos: {
    title: 'Photos',
    reason: 'So they can attach work they have already saved.',
  },
};

/** True when asking again will show a dialog. Everything else needs Settings. */
export function canAsk(state: PermissionState): boolean {
  return state === 'undetermined' || state === 'denied';
}

/** True when every permission the caller named has actually been granted. */
export function allGranted(
  statuses: Readonly<Record<PermissionKey, PermissionState>>,
  keys: readonly PermissionKey[],
): boolean {
  return keys.every((key) => statuses[key] === 'granted');
}
