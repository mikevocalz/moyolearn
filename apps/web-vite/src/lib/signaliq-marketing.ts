/**
 * Optional analytics for the public schools page, never the learning product.
 * SOT: docs/site/signaliq-marketing-consent.md
 * SOT-KEYWORDS: signaliq marketing consent privacy schools
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

/** Preference only; never a learner or account identifier. */
export const MARKETING_CONSENT_KEY = 'moyo:schools-analytics:v1';
// SDK v1's documented anonymous localStorage key. Denial can clear a previous
// document's identifier without fetching or initializing the SDK.
const SIGNALIQ_ANONYMOUS_KEY = 'siq_anon';

/** Serializable UI state; imperative SDK/session handles are deliberately excluded. */
export interface MarketingConsentState {
  readonly consented: boolean;
  readonly status: 'disabled' | 'off' | 'blocked' | 'loading' | 'on' | 'error';
}

interface WebsiteClient {
  page: (input: { path: string }) => void;
  setConsent: (consented: boolean) => void;
  flush: () => Promise<void>;
  dispose: () => void;
}

interface WebsiteSdk {
  createWebsiteClient: (options: {
    writeKey: string;
    endpoint: string;
    consent: false;
    onError: () => void;
  }) => WebsiteClient;
}

/** Inject the browser boundary so consent/path races can be tested without network access. */
export interface MarketingEnvironment {
  readonly pathname: () => string;
  readonly globalPrivacyControl: () => boolean;
  readonly readConsent: () => boolean;
  readonly writeConsent: (consented: boolean) => void;
  readonly loadSdk: (url: string, signal: AbortSignal) => Promise<WebsiteSdk>;
  readonly listen: (preferenceChanged: () => void, environmentChanged: () => void) => () => void;
}

interface MarketingConfiguration {
  readonly writeKey: string;
  readonly endpoint: string;
  readonly sdkUrl: string;
}

/** Only this literal public path is eligible. Queries, fragments and prefixes fail closed. */
export function marketingPath(pathname: string): '/for-schools' | null {
  return pathname === '/for-schools' ? '/for-schools' : null;
}

/** Reject incomplete configuration and endpoints that could expose credentials or URL data. */
export function marketingConfiguration(writeKey?: string, endpoint?: string): MarketingConfiguration | null {
  if (!writeKey?.trim() || !endpoint) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.pathname !== '/api/ingest/v1/events') return null;
    return { writeKey: writeKey.trim(), endpoint: url.href, sdkUrl: new URL('/sdk/v1.js', url).href };
  } catch {
    return null;
  }
}

/** Create one SSR-safe preference store per mounted control; SDK handles stay outside state. */
export function createMarketingConsentStore(configured: boolean) {
  return createStore<MarketingConsentState>(() => ({
    consented: false,
    status: configured ? 'off' : 'disabled',
  }));
}

/**
 * Own the optional SDK session. Creation reads an existing explicit preference;
 * setConsent persists a choice, refresh rechecks GPC/path, and dispose revokes
 * and releases every listener. No events other than the literal page are exposed.
 */
export function createMarketingAnalytics(options: {
  readonly configuration: MarketingConfiguration | null;
  readonly store: StoreApi<MarketingConsentState>;
  readonly environment: MarketingEnvironment;
}) {
  const { configuration, store, environment } = options;
  let consented = environment.readConsent();
  let disposed = false;
  let client: WebsiteClient | null = null;
  let loading: AbortController | null = null;
  let generation = 0;

  const stop = () => {
    generation += 1;
    loading?.abort();
    loading = null;
    const previous = client;
    client = null;
    if (previous) {
      // A broken optional SDK must not prevent the other teardown steps.
      try { previous.setConsent(false); } catch { /* Still attempt disposal. */ }
      try { previous.dispose(); } catch { /* Local ownership is already revoked. */ }
    }
  };
  const update = (status: MarketingConsentState['status']) => store.setState({ consented, status });

  const refresh = () => {
    if (disposed) return;
    if (!configuration) {
      stop();
      consented = false;
      update('disabled');
      return;
    }
    if (environment.globalPrivacyControl()) {
      stop();
      consented = false;
      environment.writeConsent(false);
      update('blocked');
      return;
    }
    if (!consented) {
      stop();
      update('off');
      return;
    }
    if (!marketingPath(environment.pathname())) {
      stop();
      update('on');
      return;
    }
    if (client || loading) return;
    const pending = new AbortController();
    const startedGeneration = ++generation;
    loading = pending;
    update('loading');
    const fail = () => {
      if (!disposed && consented && startedGeneration === generation && !pending.signal.aborted
        && !environment.globalPrivacyControl() && marketingPath(environment.pathname())) update('error');
    };
    void environment.loadSdk(configuration.sdkUrl, pending.signal).then((sdk) => {
      if (disposed || pending.signal.aborted) return;
      loading = null;
      // Consent, GPC and path can change while the external script loads.
      consented = environment.readConsent();
      if (!consented || environment.globalPrivacyControl() || !marketingPath(environment.pathname())) {
        refresh();
        return;
      }
      client = sdk.createWebsiteClient({
        writeKey: configuration.writeKey,
        endpoint: configuration.endpoint,
        consent: false,
        onError: fail,
      });
      client.setConsent(true);
      client.page({ path: '/for-schools' });
      update('on');
      void client.flush().catch(fail);
    }).catch(() => {
      if (loading === pending) loading = null;
      fail();
    });
  };

  const refreshPreference = () => {
    consented = environment.readConsent();
    refresh();
  };
  const unlisten = environment.listen(refreshPreference, refreshPreference);
  refresh();

  return {
    /** Store the visitor's explicit choice. A GPC signal always overrides a grant. */
    setConsent(next: boolean) {
      if (disposed || !configuration) return;
      consented = next && !environment.globalPrivacyControl();
      environment.writeConsent(consented);
      refresh();
    },
    refresh: refreshPreference,
    /** Revoke immediately and release this mounted session; safe to call repeatedly. */
    dispose() {
      if (disposed) return;
      disposed = true;
      try { stop(); } finally { unlisten(); }
    },
  };
}

/** Browser boundary: no storage access or script request occurs during SSR. */
export function browserMarketingEnvironment(browser: Window): MarketingEnvironment {
  // A failed storage write still allows an explicit choice for this visit.
  // A later cross-tab preference event supersedes that in-memory fallback.
  let visitConsent: boolean | null = null;
  const readConsent = () => {
    if (visitConsent !== null) return visitConsent;
    try { return browser.localStorage.getItem(MARKETING_CONSENT_KEY) === 'granted'; }
    catch { return false; }
  };
  return {
    pathname: () => browser.location.pathname,
    globalPrivacyControl: () => (browser.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    readConsent,
    writeConsent(consented) {
      try {
        browser.localStorage.setItem(MARKETING_CONSENT_KEY, consented ? 'granted' : 'denied');
        visitConsent = null;
      } catch { visitConsent = consented; }
      if (!consented) {
        try { browser.localStorage.removeItem(SIGNALIQ_ANONYMOUS_KEY); }
        catch { /* Storage may be unavailable; denial still prevents SDK loading/sending. */ }
      }
    },
    loadSdk(url, signal) {
      return new Promise((resolve, reject) => {
        const sdk = () => (browser as Window & { SignalIQ?: WebsiteSdk }).SignalIQ;
        if (signal.aborted) { reject(new Error('Analytics load cancelled')); return; }
        if (sdk()?.createWebsiteClient) { resolve(sdk()!); return; }
        const script = browser.document.createElement('script');
        script.referrerPolicy = 'no-referrer';
        script.crossOrigin = 'anonymous';
        script.src = url;
        script.async = true;
        const cleanup = () => {
          script.onload = null;
          script.onerror = null;
          signal.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          script.remove();
          reject(new Error('Analytics load cancelled'));
        };
        script.onload = () => {
          cleanup();
          const loaded = sdk();
          if (loaded?.createWebsiteClient) resolve(loaded);
          else { script.remove(); reject(new Error('Analytics unavailable')); }
        };
        script.onerror = () => {
          cleanup();
          script.remove();
          reject(new Error('Analytics unavailable'));
        };
        signal.addEventListener('abort', abort, { once: true });
        browser.document.head.append(script);
      });
    },
    listen(preferenceChanged, environmentChanged) {
      const storage = (event: StorageEvent) => {
        // The localStorage getter can throw. readConsent() fails closed instead.
        if (event.key === MARKETING_CONSENT_KEY || event.key === null) {
          visitConsent = null;
          preferenceChanged();
        }
      };
      browser.addEventListener('storage', storage);
      browser.addEventListener('focus', environmentChanged);
      browser.addEventListener('popstate', environmentChanged);
      browser.document.addEventListener('visibilitychange', environmentChanged);
      return () => {
        browser.removeEventListener('storage', storage);
        browser.removeEventListener('focus', environmentChanged);
        browser.removeEventListener('popstate', environmentChanged);
        browser.document.removeEventListener('visibilitychange', environmentChanged);
      };
    },
  };
}
