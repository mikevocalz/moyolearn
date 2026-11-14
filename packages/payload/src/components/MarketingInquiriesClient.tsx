'use client';
// Extend Payload's existing controls and shell; the API rechecks internal identity.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing payload inbox booking consent receipt retry
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  Banner,
  Button,
  Collapsible,
  DatePicker,
  FieldLabel,
  Gutter,
  TextInput,
} from '@payloadcms/ui';
import { marketingInboxResponse } from '../marketing/contract.ts';
import type { InquirySummary, InquiryUpdate } from '../marketing/contract.ts';
import type { z } from 'zod';
import './marketing-inquiries.css';

type Inbox = z.infer<typeof marketingInboxResponse>;
type WithoutRequest<T> = T extends InquiryUpdate ? Omit<T, 'requestId'> : never;
const time = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
const api = '/payload-api/moyo-sales/inquiries';
async function failure(response: Response) {
  const body = await response.json().catch(() => null);
  return new Error(
    body && typeof body.error === 'string'
      ? body.error
      : 'The request was not confirmed. Retry the same action.',
  );
}

function InquiryCard({
  inquiry,
  refresh,
  stale,
  onUnauthorized,
}: {
  inquiry: InquirySummary;
  refresh: () => Promise<void>;
  stale: boolean;
  onUnauthorized: () => void;
}) {
  const store = useMemo(
    () =>
      createStore(() => ({
        scheduledAt: '',
        referenceId: inquiry.billing_reference_id ?? '',
        busy: false,
        error: '',
        notice: '',
      })),
    [inquiry.billing_reference_id],
  );
  const state = useStore(store);
  const disabled = state.busy || stale;
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  async function update(fields: WithoutRequest<InquiryUpdate>) {
    if (disabled) return;
    const signature = JSON.stringify(fields);
    if (pending.current?.signature !== signature)
      pending.current = { signature, requestId: crypto.randomUUID() };
    store.setState({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(`${api}/${inquiry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          requestId: pending.current.requestId,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          onUnauthorized();
        throw await failure(response);
      }
      pending.current = null;
      store.setState({
        notice:
          fields.action === 'withdraw'
            ? 'Inquiry withdrawn. Any required SignalIQ suppression is tracked below.'
            : fields.action === 'booking'
              ? 'Discovery call recorded. Send the invitation through your normal calendar tool.'
              : 'Update saved.',
      });
      await refresh();
    } catch (error) {
      store.setState({
        error:
          error instanceof Error
            ? error.message
            : 'The update was not confirmed. Retry the same action.',
      });
    } finally {
      store.setState({ busy: false });
    }
  }
  const inactive = Boolean(inquiry.withdrawn_at);
  return (
    <Collapsible
      initCollapsed
      header={`${inquiry.contact_name} · ${inquiry.organization_name || 'Family inquiry'}`}
    >
      <section className="moyo-sales__record">
        <p>
          {inquiry.email} · Received {time(inquiry.created_at)}
        </p>
        <p>
          {inactive
            ? 'Withdrawn'
            : inquiry.signal_consent
              ? 'Optional SignalIQ sharing allowed'
              : 'Moyo response only; no SignalIQ sharing'}
        </p>
        <p>
          {inquiry.pending} awaiting SignalIQ confirmation · {inquiry.attention}{' '}
          need attention{inquiry.last_error ? ` (${inquiry.last_error})` : ''}
        </p>
        {inquiry.signal_consent && inquiry.billing_waiting > 0 && (
          <p>
            {inquiry.billing_waiting} saved invoice receipt(s) await the exact
            Moyo subscription association. No sale is sent until that link is
            confirmed.
          </p>
        )}
        {inquiry.signal_consent && inquiry.billing_attention > 0 && (
          <Banner type="warning">
            {inquiry.billing_attention} invoice receipt(s) need verification. No
            revenue is sent from those receipts.
            {inquiry.billing_error ? ` (${inquiry.billing_error})` : ''}
          </Banner>
        )}
        {inquiry.scheduled_at && (
          <p>Recorded discovery call: {time(inquiry.scheduled_at)}</p>
        )}
        {!inactive && (
          <>
            <FieldLabel
              htmlFor={`booking-${inquiry.id}`}
              label="Discovery-call date and time"
            />
            <DatePicker
              id={`booking-wrapper-${inquiry.id}`}
              overrides={{ id: `booking-${inquiry.id}` }}
              value={state.scheduledAt}
              pickerAppearance="dayAndTime"
              onChange={(value) =>
                store.setState({ scheduledAt: value?.toISOString() ?? '' })
              }
              readOnly={disabled}
            />
            <p>Choose the time in your browser’s local timezone.</p>
            <Button
              disabled={disabled || !state.scheduledAt}
              onClick={() =>
                void update({
                  action: 'booking',
                  scheduledAt: state.scheduledAt,
                })
              }
            >
              Record scheduled discovery call
            </Button>
            <Gutter left={false} right={false} className="moyo-sales__actions">
              {(
                [
                  'contacted',
                  'pilot-started',
                  'proposal-sent',
                  'closed',
                ] as const
              ).map((stage) => (
                <Button
                  key={stage}
                  buttonStyle="secondary"
                  disabled={disabled}
                  onClick={() => void update({ action: 'progress', stage })}
                >
                  {stage.replaceAll('-', ' ')}
                </Button>
              ))}
            </Gutter>
            <TextInput
              path={`billing-${inquiry.id}`}
              label="Moyo subscription reference"
              value={state.referenceId}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                store.setState({ referenceId: event.target.value })
              }
              readOnly={disabled}
            />
            <p>
              Link the actual organization or verified adult account attached to
              its subscription. A link does not record a sale; a confirmed paid
              invoice is required.
            </p>
            <Button
              buttonStyle="secondary"
              disabled={disabled || !state.referenceId}
              onClick={() =>
                void update({
                  action: 'link-billing',
                  referenceId: state.referenceId,
                })
              }
            >
              Link subscription
            </Button>
          </>
        )}
        <Gutter left={false} right={false} className="moyo-sales__actions">
          {!inactive &&
            inquiry.signal_consent &&
            inquiry.billing_attention > 0 && (
              <Button
                buttonStyle="secondary"
                disabled={disabled}
                onClick={() => void update({ action: 'retry-billing' })}
              >
                Recheck invoice evidence
              </Button>
            )}
          {inquiry.attention > 0 && (
            <Button
              buttonStyle="secondary"
              disabled={disabled}
              onClick={() => void update({ action: 'retry-delivery' })}
            >
              Retry after fixing source setup
            </Button>
          )}
          <Button
            buttonStyle="secondary"
            disabled={disabled}
            onClick={() => void update({ action: 'withdraw' })}
          >
            {inactive
              ? 'Retry consent suppression'
              : 'Withdraw inquiry and sharing'}
          </Button>
        </Gutter>
        {state.error && <Banner type="danger">{state.error}</Banner>}
        {state.notice && <Banner type="success">{state.notice}</Banner>}
      </section>
    </Collapsible>
  );
}

export function MarketingInquiriesClient({
  initialData,
}: {
  initialData: Inbox;
}) {
  const store = useMemo(
    () =>
      createStore(() => ({
        data: initialData as Inbox | null,
        error: '',
        refreshing: false,
      })),
    [initialData],
  );
  const state = useStore(store);
  const readGeneration = useRef(0);
  const invalidateReads = useCallback(() => {
    readGeneration.current++;
  }, []);
  const onUnauthorized = useCallback(() => {
    readGeneration.current++;
    store.setState({
      data: null,
      refreshing: false,
      error: 'Sign in again to the authorized internal admin account.',
    });
  }, [store]);
  const refresh = useCallback(async () => {
    const generation = ++readGeneration.current;
    store.setState({ refreshing: true });
    try {
      const response = await fetch(api, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (generation !== readGeneration.current) return;
      if (!response.ok) {
        // Revoked sessions clear private data. Transient polling failures keep
        // mounted cards so uncertain POST retries retain their original IDs.
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw await failure(response);
      }
      const data = marketingInboxResponse.parse(await response.json());
      if (generation !== readGeneration.current) return;
      store.setState({
        data,
        error: '',
      });
    } catch (error) {
      if (generation !== readGeneration.current) return;
      store.setState({
        error:
          error instanceof Error
            ? error.message
            : 'The inbox could not be refreshed.',
      });
    } finally {
      if (generation === readGeneration.current)
        store.setState({ refreshing: false });
    }
  }, [store, onUnauthorized]);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      clearInterval(timer);
      invalidateReads();
    };
  }, [refresh, invalidateReads]);
  return (
    <section className="moyo-sales">
      <h2>SignalIQ delivery</h2>
      <p>
        Delivered means SignalIQ confirmed processing. Accepted and pending
        still need confirmation. The latest 100 inquiries are shown.
      </p>
      <Button
        buttonStyle="secondary"
        disabled={state.refreshing}
        onClick={() => void refresh()}
      >
        Refresh delivery status
      </Button>
      {state.error && (
        <Banner type="danger">
          {state.error}
          {state.data
            ? ' Last saved data remains visible. Refresh status before saving another update.'
            : ''}
        </Banner>
      )}
      {state.data && (
        <>
          {state.data.delivery.length === 0 && (
            <p>
              No delivery has been confirmed yet. New requests stay saved in
              Moyo while their optional sharing is processed.
            </p>
          )}
          {state.data.delivery.map((row) => (
            <p key={row.state}>
              {row.state}: {row.count}
              {row.last_delivered_at
                ? ` · Last confirmed ${time(row.last_delivered_at)}`
                : ''}
            </p>
          ))}
          {state.data.inquiries.length === 0 && (
            <p>No adult website inquiries have been saved yet.</p>
          )}
          {state.data.inquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              refresh={refresh}
              stale={Boolean(state.error)}
              onUnauthorized={onUnauthorized}
            />
          ))}
        </>
      )}
    </section>
  );
}
