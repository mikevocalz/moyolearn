// PLATFORM FORK — no encrypted local cache on web, deliberately.
//
// §2.1/§2.2 keep web sessions in httpOnly cookies and put nothing sensitive in
// browser storage. An "encrypted" web cache would need its key in the same
// storage as the data, which is not encryption, it is filing. So the web build
// has no user cache and the functions say so rather than pretending.
// SOT: docs/pack/07-security-spec.md §2.2
// SOT-KEYWORDS: cache web unavailable no local storage encrypted mmkv

const unavailable = (): never => {
  throw new Error(
    'There is no encrypted local cache on web. Server-render or refetch; browser storage holds no learner data.',
  );
};

export const openUserCache = async (_userId: string): Promise<never> => unavailable();
export const wipeUserCache = async (_userId: string): Promise<void> => {
  // Nothing was ever written, so sign-out has nothing to clear. This one does
  // NOT throw: sign-out is a shared code path and must not fail by platform.
};
export const putLearnerProjection = (_cache: unknown, _key: string, _value: unknown): void =>
  unavailable();
