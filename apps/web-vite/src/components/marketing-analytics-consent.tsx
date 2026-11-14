/**
 * Explicit analytics choice for the schools marketing pilot.
 * SOT: docs/site/signaliq-marketing-consent.md
 * SOT-KEYWORDS: schools optional analytics consent privacy zustand
 */
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { Button, Link, Paragraph, View } from '@acme/ui/primitives';
import { Container, Heading } from '@acme/ui/typography';
import {
  browserMarketingEnvironment,
  createMarketingAnalytics,
  createMarketingConsentStore,
  marketingConfiguration,
} from '@/lib/signaliq-marketing';

const configuration = marketingConfiguration(
  import.meta.env.VITE_SIGNALIQ_WRITE_KEY,
  import.meta.env.VITE_SIGNALIQ_ENDPOINT,
);

/** A visible, optional choice. Privacy-page mounting never qualifies for a page event. */
export function MarketingAnalyticsConsent() {
  const storeRef = useRef<ReturnType<typeof createMarketingConsentStore> | null>(null);
  if (storeRef.current === null) storeRef.current = createMarketingConsentStore(configuration !== null);
  const store = storeRef.current;
  const controller = useRef<ReturnType<typeof createMarketingAnalytics> | null>(null);
  const consented = useStore(store, (state) => state.consented);
  const status = useStore(store, (state) => state.status);

  useEffect(() => {
    const analytics = createMarketingAnalytics({ configuration, store, environment: browserMarketingEnvironment(window) });
    controller.current = analytics;
    return () => {
      controller.current = null;
      analytics.dispose();
    };
  }, [store]);

  const message = status === 'disabled' ? 'Optional analytics is not enabled on this site.'
    : status === 'blocked' ? 'Off. Your Global Privacy Control signal is respected.'
      : status === 'loading' ? 'Starting optional analytics…'
        : status === 'error' ? 'Analytics could not start. Turn it off and enable it again to retry.'
          : consented ? 'On for the schools page only. You can turn it off at any time.'
            : 'Off. Nothing is sent unless you choose to enable it.';

  return (
    <Container width="detail" id="optional-analytics" className="gap-group py-section">
      <Heading level={2} className="font-moyo-text text-site-subtitle text-moyo-ink">Optional schools-page analytics</Heading>
      <Paragraph className="text-site-body text-moyo-ink">
        Help us understand visits to our public schools page with SignalIQ. If you opt in, SignalIQ receives the page path /for-schools, a random browser identifier, the event time, and technical request data such as your network address. We do not send names, email addresses, form contents, query strings, or learning activity. This choice is optional and does not affect Moyo.
      </Paragraph>
      <Paragraph role="status" aria-live="polite" className="text-site-body text-moyo-ink">{message}</Paragraph>
      <View className="items-start gap-group">
        <Button
          onPress={() => controller.current?.setConsent(!consented)}
          disabled={status === 'disabled' || status === 'blocked'}
          role="switch"
          aria-checked={consented}
          aria-label="Optional schools-page analytics"
          className="rounded-moyo-card border border-moyo-ink px-6 py-3 text-site-body text-moyo-ink disabled:opacity-50"
        >
          {consented ? 'Turn off optional analytics' : 'Enable optional analytics'}
        </Button>
        <Link href="/privacy#optional-analytics" className="text-site-body text-moyo-primary underline">Privacy and analytics choices</Link>
      </View>
    </Container>
  );
}
