import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  browserMarketingEnvironment,
  createMarketingAnalytics,
  createMarketingConsentStore,
  marketingConfiguration,
  marketingPath,
  MARKETING_CONSENT_KEY,
  type MarketingEnvironment,
} from './signaliq-marketing.ts';

const configuration = marketingConfiguration('public-test-key', 'https://analytics.example/api/ingest/v1/events')!;
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(input: { path?: string; consent?: boolean; gpc?: boolean; pending?: boolean; configured?: boolean; pendingFlush?: boolean; teardownThrows?: boolean } = {}) {
  let path = input.path ?? '/for-schools';
  let consent = input.consent ?? false;
  let gpc = input.gpc ?? false;
  let preferenceChanged = () => {};
  let environmentChanged = () => {};
  let unlistened = 0;
  const loads: { url: string; signal: AbortSignal }[] = [];
  const pages: { path: string }[] = [];
  const grants: boolean[] = [];
  const created: unknown[] = [];
  let disposed = 0;
  let resolveLoad: (() => void) | undefined;
  let rejectFlush: ((error: Error) => void) | undefined;
  const sdk = {
    createWebsiteClient(options: unknown) {
      created.push(options);
      return {
        page: (page: { path: string }) => { pages.push(page); },
        setConsent: (value: boolean) => {
          grants.push(value);
          if (!value && input.teardownThrows) throw new Error('Synthetic SDK revocation failure');
        },
        flush: () => input.pendingFlush && !rejectFlush
          ? new Promise<void>((_, reject) => { rejectFlush = reject; })
          : Promise.resolve(),
        dispose: () => {
          disposed += 1;
          if (input.teardownThrows) throw new Error('Synthetic SDK disposal failure');
        },
      };
    },
  };
  const environment: MarketingEnvironment = {
    pathname: () => path,
    globalPrivacyControl: () => gpc,
    readConsent: () => consent,
    writeConsent: (value) => { consent = value; },
    loadSdk(url, signal) {
      loads.push({ url, signal });
      if (input.pending) return new Promise((resolve) => { resolveLoad = () => resolve(sdk); });
      return Promise.resolve(sdk);
    },
    listen(preference, changed) {
      preferenceChanged = preference;
      environmentChanged = changed;
      return () => { unlistened += 1; };
    },
  };
  const store = createMarketingConsentStore(input.configured !== false);
  const controller = createMarketingAnalytics({ configuration: input.configured === false ? null : configuration, store, environment });
  return {
    store, controller, loads, pages, grants, created,
    resolveLoad: () => resolveLoad?.(),
    rejectFlush: () => rejectFlush?.(new Error('Synthetic transport failure')),
    counts: () => ({ disposed, unlistened }),
    path: (value: string, notify = true) => { path = value; if (notify) environmentChanged(); },
    gpc: (value: boolean, notify = true) => { gpc = value; if (notify) environmentChanged(); },
    preference: (value: boolean, notify = true) => { consent = value; if (notify) preferenceChanged(); },
    environmentChanged: () => environmentChanged(),
  };
}

test('missing configuration and default denial never load the SDK', async () => {
  const disabled = harness({ configured: false, consent: true });
  disabled.controller.setConsent(true);
  assert.equal(disabled.store.getState().status, 'disabled');
  assert.equal(disabled.loads.length, 0);
  const denied = harness();
  denied.controller.setConsent(false);
  await settled();
  assert.equal(denied.loads.length, 0);
  assert.deepEqual(denied.store.getState(), { consented: false, status: 'off' });
});

test('only an explicit grant loads the SDK and sends the literal path', async () => {
  const h = harness();
  h.controller.setConsent(true);
  await settled();
  assert.deepEqual(h.loads.map(({ url }) => url), ['https://analytics.example/sdk/v1.js']);
  assert.deepEqual(h.pages, [{ path: '/for-schools' }]);
  assert.deepEqual(h.grants, [true]);
  assert.deepEqual(Object.keys(h.created[0] as object).sort(), ['consent', 'endpoint', 'onError', 'writeKey']);
  assert.equal((h.created[0] as { consent: boolean }).consent, false);
  h.controller.refresh();
  assert.equal(h.pages.length, 1);
  h.controller.dispose();
});

test('GPC overrides both stored and new grants, and immediately revokes an active session', async () => {
  const blocked = harness({ consent: true, gpc: true });
  blocked.controller.setConsent(true);
  await settled();
  assert.deepEqual(blocked.store.getState(), { consented: false, status: 'blocked' });
  assert.equal(blocked.loads.length, 0);
  const active = harness({ consent: true });
  await settled();
  active.gpc(true);
  assert.deepEqual(active.grants, [true, false]);
  assert.equal(active.counts().disposed, 1);
  assert.equal(active.store.getState().status, 'blocked');
});

test('private, learning, authentication, payment and other marketing paths never load', async () => {
  for (const path of ['/', '/privacy', '/for-parents', '/learner', '/learn', '/tutor', '/teacher', '/login', '/auth/callback', '/onboarding', '/admin', '/checkout', '/for-schools/learners', '/for-schools?email=private', '/for-schools#private', '/%66or-schools', '/for-schools/']) {
    assert.equal(marketingPath(path), null, path);
    const h = harness({ path, consent: true });
    h.controller.setConsent(true);
    await settled();
    assert.equal(h.loads.length, 0, path);
    assert.equal(h.pages.length, 0, path);
    h.controller.dispose();
  }
});

test('revocation while the SDK loads aborts it and ignores a late completion', async () => {
  const h = harness({ pending: true });
  h.controller.setConsent(true);
  h.controller.setConsent(false);
  assert.equal(h.loads[0]?.signal.aborted, true);
  h.resolveLoad();
  await settled();
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.store.getState(), { consented: false, status: 'off' });
});

test('consent, GPC and route are rechecked after an asynchronous load', async () => {
  for (const change of ['consent', 'gpc', 'path'] as const) {
    const h = harness({ pending: true, consent: true });
    // Change without a browser notification to exercise the post-load guard itself.
    if (change === 'consent') h.preference(false, false);
    else if (change === 'gpc') h.gpc(true, false);
    else h.path('/learner/private', false);
    h.resolveLoad();
    await settled();
    assert.equal(h.created.length, 0);
    assert.equal(h.pages.length, 0);
  }
});

test('focus and visibility refreshes recover a missed cross-tab denial', async () => {
  const h = harness({ consent: true });
  await settled();
  h.preference(false, false);
  h.environmentChanged();
  assert.deepEqual(h.grants, [true, false]);
  assert.deepEqual(h.store.getState(), { consented: false, status: 'off' });
  assert.equal(h.counts().disposed, 1);
  h.controller.dispose();
});

test('SDK teardown failures cannot interrupt revocation or leak browser listeners', async () => {
  const h = harness({ consent: true, teardownThrows: true });
  await settled();
  assert.doesNotThrow(() => h.controller.setConsent(false));
  assert.deepEqual(h.store.getState(), { consented: false, status: 'off' });
  assert.doesNotThrow(() => h.controller.dispose());
  assert.deepEqual(h.counts(), { disposed: 1, unlistened: 1 });
});

test('cross-tab denial, route exit and teardown revoke the client and release listeners', async () => {
  const h = harness({ consent: true });
  await settled();
  h.preference(false);
  assert.deepEqual(h.grants, [true, false]);
  assert.equal(h.counts().disposed, 1);
  h.controller.setConsent(true);
  await settled();
  h.path('/checkout');
  assert.deepEqual(h.grants, [true, false, true, false]);
  h.controller.dispose();
  h.controller.dispose();
  assert.deepEqual(h.counts(), { disposed: 2, unlistened: 1 });
});

test('stale flush errors cannot undo denial or mark a later session as failed', async () => {
  const h = harness({ consent: true, pendingFlush: true });
  await settled();
  h.controller.setConsent(false);
  h.controller.setConsent(true);
  await settled();
  h.rejectFlush();
  await settled();
  assert.deepEqual(h.store.getState(), { consented: true, status: 'on' });
  h.controller.dispose();
});

test('disposing a pending load is idempotent and cannot create a late session', async () => {
  const h = harness({ consent: true, pending: true });
  h.controller.dispose();
  h.controller.dispose();
  h.resolveLoad();
  await settled();
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.counts(), { disposed: 0, unlistened: 1 });
});

test('configuration rejects insecure, credential-bearing or query-bearing URLs', () => {
  assert.equal(marketingConfiguration(undefined, configuration.endpoint), null);
  assert.equal(marketingConfiguration('key', undefined), null);
  for (const endpoint of ['http://analytics.example/api/ingest/v1/events', 'https://user:pass@analytics.example/api/ingest/v1/events', 'https://analytics.example/api/ingest/v1/events?email=private', 'https://analytics.example/api/ingest/v1/events#private', 'https://analytics.example/wrong', 'invalid']) {
    assert.equal(marketingConfiguration('key', endpoint), null);
  }
});

test('the script request suppresses Referer and an abort removes the pending element', async () => {
  let removed = 0;
  const script = { referrerPolicy: '', crossOrigin: '', src: '', async: false, onload: null, onerror: null, remove: () => { removed += 1; } };
  const browser = {
    document: {
      createElement: () => script,
      head: { append: () => {
        assert.equal(script.referrerPolicy, 'no-referrer');
        assert.equal(script.crossOrigin, 'anonymous');
        assert.equal(script.src, 'https://analytics.example/sdk/v1.js');
      } },
    },
  } as unknown as Window;
  const pending = new AbortController();
  const result = browserMarketingEnvironment(browser).loadSdk('https://analytics.example/sdk/v1.js', pending.signal);
  pending.abort();
  await assert.rejects(result, /cancelled/);
  assert.equal(removed, 1);
  assert.equal(script.onload, null);
  assert.equal(script.onerror, null);
});

test('a blocked localStorage getter fails closed during preference events', () => {
  let storageListener: ((event: StorageEvent) => void) | undefined;
  const browser = {
    get localStorage() { throw new Error('Synthetic storage denial'); },
    addEventListener(name: string, callback: (event: StorageEvent) => void) {
      if (name === 'storage') storageListener = callback;
    },
    removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {} },
  } as unknown as Window;
  const environment = browserMarketingEnvironment(browser);
  let consented = true;
  const unlisten = environment.listen(() => { consented = environment.readConsent(); }, () => {});
  assert.doesNotThrow(() => storageListener?.({ key: MARKETING_CONSENT_KEY } as StorageEvent));
  assert.equal(consented, false);
  assert.doesNotThrow(() => environment.writeConsent(false));
  unlisten();
});

test('explicit denial removes only the documented SDK identifier without loading a script', () => {
  const entries = new Map([['siq_anon', 'anonymous-test-id'], ['unrelated', 'keep']]);
  const browser = {
    localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    },
  } as unknown as Window;
  browserMarketingEnvironment(browser).writeConsent(false);
  assert.deepEqual([...entries], [['unrelated', 'keep'], [MARKETING_CONSENT_KEY, 'denied']]);
});

test('a blocked storage write keeps an explicit visit choice until a preference event', () => {
  let storageListener: ((event: StorageEvent) => void) | undefined;
  const browser = {
    localStorage: {
      getItem: () => 'denied',
      setItem: () => { throw new Error('Synthetic storage quota failure'); },
      removeItem() {},
    },
    addEventListener(name: string, callback: (event: StorageEvent) => void) {
      if (name === 'storage') storageListener = callback;
    },
    removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {} },
  } as unknown as Window;
  const environment = browserMarketingEnvironment(browser);
  assert.equal(environment.readConsent(), false);
  environment.writeConsent(true);
  assert.equal(environment.readConsent(), true);
  assert.equal(browserMarketingEnvironment(browser).readConsent(), false);
  const unlisten = environment.listen(() => {}, () => {});
  storageListener?.({ key: MARKETING_CONSENT_KEY } as StorageEvent);
  assert.equal(environment.readConsent(), false);
  unlisten();
});
