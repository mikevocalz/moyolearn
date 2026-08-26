// Native: the store tus-js-client cannot provide for itself.
//
// tus-js-client resumes an interrupted upload by remembering its upload URL
// against a fingerprint. On React Native there is no Web Storage API, so
// `canStoreURLs` is permanently `false` and the library IGNORES `fingerprint`,
// `storeFingerprintForResuming` and `removeFingerprintOnSuccess` outright. The
// failure is quiet: `findPreviousUploads()` returns an empty array forever, so a
// resumable upload silently becomes a restartable one, and a parent on a train
// re-sends a 200MB video from zero.
//
// MMKV because persistence in this codebase is MMKV — synchronous, so the four
// methods below are trivially Promise-wrapped rather than genuinely async.
// SOT: https://github.com/tus/tus-js-client/blob/main/docs/installation.md
// SOT-KEYWORDS: tus url storage resume upload media native mmkv fingerprint
import { createMMKV } from 'react-native-mmkv';
import type { TusUrlStorage } from './tus-url-storage.types.ts';

const store = createMMKV({ id: 'tus-uploads' });

/** One key per stored upload. The prefix keeps the scan cheap and scoped. */
const KEY = 'tus::';

/*
  Mirrors tus-js-client's `PreviousUpload` minus its storage key, which this
  store owns. Both URL fields are `| null` rather than optional because that is
  what the library's own type says — an optional would typecheck here and then
  hand `undefined` to code expecting `null`.
*/
interface StoredUpload {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
}

const read = (key: string): StoredUpload | null => {
  const raw = store.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUpload;
  } catch {
    /*
      A corrupt entry is dropped rather than thrown on. This store exists to make
      a retry cheaper; failing the upload because its bookkeeping is unreadable
      would be the store defeating its own purpose.
    */
    store.remove(key);
    return null;
  }
};

const asPrevious = (key: string, value: StoredUpload) => ({
  size: value.size,
  metadata: value.metadata,
  creationTime: value.creationTime,
  uploadUrl: value.uploadUrl ?? null,
  parallelUploadUrls: value.parallelUploadUrls ?? null,
  urlStorageKey: key,
});

export const tusUrlStorage = (): TusUrlStorage => ({
  findAllUploads: async () =>
    store
      .getAllKeys()
      .filter((k) => k.startsWith(KEY))
      .flatMap((k) => {
        const v = read(k);
        return v ? [asPrevious(k, v)] : [];
      }),

  findUploadsByFingerprint: async (fingerprint) => {
    const key = `${KEY}${fingerprint}`;
    const value = read(key);
    return value ? [asPrevious(key, value)] : [];
  },

  removeUpload: async (urlStorageKey) => {
    store.remove(urlStorageKey);
  },

  addUpload: async (fingerprint, upload) => {
    const key = `${KEY}${fingerprint}`;
    store.set(key, JSON.stringify(upload));
    return key;
  },
});
