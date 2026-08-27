// MMKV, instance id `capture`. Its reads are synchronous, so the first render
// already knows whether the learner has a problem in flight — no flash of a
// generated one. (CLAUDE.md: persistence is MMKV, state is Zustand.)
import { createMMKV } from 'react-native-mmkv';
import type { ProblemStorage } from './problem-storage.shared.ts';

const mmkv = createMMKV({ id: 'capture' });

export const problemStorage: ProblemStorage = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  // MMKV 4 calls it `remove`, not `delete` — the same rename that caught the
  // tus URL storage in this repo.
  remove: (key) => {
    mmkv.remove(key);
  },
};
