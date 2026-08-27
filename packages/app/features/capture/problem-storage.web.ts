// localStorage behind MMKV's shape. Absent while Next renders on the server, so
// every accessor is optional-chained rather than guarded once — the module is
// imported during SSR even though nothing calls it there.
import type { ProblemStorage } from './problem-storage.shared.ts';

export const problemStorage: ProblemStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};
