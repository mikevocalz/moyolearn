/**
 * The session cookie in memory, written through to one secure-storage slot.
 *
 * Every request reads a snapshot `{ cookie, generation }` before it goes out.
 * `forget()` (sign-out, a server-ended session) bumps the generation, so a
 * response that started earlier and lands afterwards changes nothing: its
 * Set-Cookie cannot put a session back into the Keychain. A response that is
 * still current is merged into the cookie held now, not the snapshot it was
 * sent with, so two parallel requests that each refresh a cookie both land.
 * Slot writes run one at a time in call order, so the Keychain always ends on
 * the last value set here.
 * No imports, so scripts/auth.test.mjs can load it under Node.
 * SOT: docs/desktop/seams/D04.md
 * SOT-KEYWORDS: desktop auth cookie jar generation keychain late response sign-out
 */

export interface SecretSlot {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  delete(): Promise<void>;
}

export interface CookieSnapshot {
  readonly cookie: string | null;
  /** Pass back to `persist`; a `forget()` in between voids it. */
  readonly generation: number;
}

export interface CookieJar {
  read(): Promise<CookieSnapshot>;
  /**
   * Applies `change` to the current cookie if nothing was forgotten since
   * `generation`. Resolves true when the cookie changed and was written.
   */
  persist(generation: number, change: (current: string | null) => string | null): Promise<boolean>;
  forget(): Promise<void>;
}

export function createCookieJar(slot: SecretSlot): CookieJar {
  /** `undefined` until the slot has been read once. */
  let cookie: string | null | undefined;
  let generation = 0;
  let loading: Promise<void> | null = null;
  let writes: Promise<unknown> = Promise.resolve();

  function write(operation: () => Promise<void>): Promise<void> {
    const next = writes.then(operation);
    writes = next.catch(() => undefined);
    return next;
  }

  function load(): Promise<void> {
    if (cookie !== undefined) return Promise.resolve();
    loading ??= (async () => {
      const ticket = generation;
      try {
        const stored = await slot.get();
        // A forget() during the read already set `cookie` to null; keep that.
        if (cookie === undefined && ticket === generation) cookie = stored;
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  return {
    async read() {
      await load();
      return { cookie: cookie ?? null, generation };
    },
    async persist(ticket, change) {
      if (ticket !== generation || cookie === undefined) return false;
      const current = cookie;
      const next = change(current);
      if (next === current) return false;
      cookie = next;
      await write(() => (next ? slot.set(next) : slot.delete()));
      return true;
    },
    forget() {
      generation += 1;
      cookie = null;
      return write(() => slot.delete());
    },
  };
}
