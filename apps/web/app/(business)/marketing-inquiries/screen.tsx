'use client';
// The backend binds this inbox to Moyo's configured sales organization.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing inbox consent booking receipt delivery status
import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useAppSession } from '@acme/app';
import { Button, Input, Label, Paragraph, View } from '@acme/ui/primitives';
import { Container, Heading } from '@acme/ui/typography';
import { marketingInboxResponse } from '@/lib/marketing/contract';
import type { InquirySummary, InquiryUpdate } from '@/lib/marketing/contract';
import { marketingKeys } from '@/lib/marketing/marketing.keys';

const fieldClass =
  'rounded-lg border border-border bg-surface px-4 py-3 text-foreground';
const buttonClass = 'rounded-lg border border-border px-4 py-3 text-foreground';
type WithoutRequest<T> = T extends InquiryUpdate ? Omit<T, 'requestId'> : never;

async function responseError(response: Response) {
  const body = await response.json().catch(() => null);
  return new Error(
    body && typeof body.error === 'string'
      ? body.error
      : 'The request could not be confirmed. Retry the same action.',
  );
}

function InquiryCard({ inquiry }: { inquiry: InquirySummary }) {
  const queryClient = useQueryClient();
  const store = useMemo(
    () =>
      createStore(() => ({
        scheduledAt: '',
        referenceId: inquiry.billing_reference_id ?? '',
        notice: '',
      })),
    [inquiry.billing_reference_id],
  );
  const value = useStore(store);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  const update = useMutation({
    mutationFn: async (fields: WithoutRequest<InquiryUpdate>) => {
      const signature = JSON.stringify(fields);
      if (pending.current?.signature !== signature)
        pending.current = { signature, requestId: crypto.randomUUID() };
      const response = await fetch(
        `/api/ops/marketing/inquiries/${inquiry.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...fields,
            requestId: pending.current.requestId,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw await responseError(response);
      pending.current = null;
      return fields.action;
    },
    onSuccess: async (action) => {
      store.setState({
        notice:
          action === 'withdraw'
            ? 'Inquiry withdrawn. Any required SignalIQ suppression is tracked below.'
            : action === 'booking'
              ? 'Discovery call recorded. Send the calendar invitation through your normal scheduling tool.'
              : 'Update saved.',
      });
      await queryClient.invalidateQueries({ queryKey: marketingKeys.all() });
    },
  });
  const inactive = Boolean(inquiry.withdrawn_at);
  return (
    <View className="gap-stack rounded-lg border border-border p-inset">
      <View className="gap-group">
        <Heading level={2}>{inquiry.contact_name}</Heading>
        <Paragraph>{inquiry.email}</Paragraph>
        <Paragraph>
          {inquiry.organization_name || 'Family inquiry'} · {inquiry.audience} ·
          Received {new Date(inquiry.created_at).toLocaleString()}
        </Paragraph>
        <Paragraph>
          {inactive
            ? 'Withdrawn'
            : inquiry.signal_consent
              ? 'Optional SignalIQ sharing allowed'
              : 'Moyo response only; no SignalIQ sharing'}
        </Paragraph>
        <Paragraph>
          {inquiry.pending} awaiting SignalIQ confirmation · {inquiry.attention}{' '}
          need attention{inquiry.last_error ? ` (${inquiry.last_error})` : ''}
        </Paragraph>
        {inquiry.scheduled_at && (
          <Paragraph>
            Recorded discovery call:{' '}
            {new Date(inquiry.scheduled_at).toLocaleString()}
          </Paragraph>
        )}
      </View>
      {!inactive && (
        <>
          <Label className="flex flex-col gap-group">
            Discovery-call date and time, with timezone
            <Input
              aria-label="Discovery-call date and time"
              placeholder="2026-12-01T14:00:00-05:00"
              value={value.scheduledAt}
              onChangeText={(scheduledAt) => store.setState({ scheduledAt })}
              editable={!update.isPending}
              className={fieldClass}
            />
          </Label>
          <Button
            disabled={update.isPending || !value.scheduledAt}
            onPress={() =>
              update.mutate({
                action: 'booking',
                scheduledAt: value.scheduledAt,
              })
            }
            className={buttonClass}
          >
            Record scheduled discovery call
          </Button>
          <View className="flex-row flex-wrap gap-group">
            {(
              ['contacted', 'pilot-started', 'proposal-sent', 'closed'] as const
            ).map((stage) => (
              <Button
                key={stage}
                disabled={update.isPending}
                onPress={() => update.mutate({ action: 'progress', stage })}
                className={buttonClass}
              >
                {stage.replaceAll('-', ' ')}
              </Button>
            ))}
          </View>
          <Label className="flex flex-col gap-group">
            Verified Moyo billing reference
            <Input
              aria-label="Verified Moyo billing reference"
              value={value.referenceId}
              onChangeText={(referenceId) => store.setState({ referenceId })}
              editable={!update.isPending}
              className={fieldClass}
            />
          </Label>
          <Paragraph>
            Use the actual organization or verified adult account ID attached to
            its Moyo subscription. A link alone does not record a sale; a
            verified paid invoice is required.
          </Paragraph>
          <Button
            disabled={update.isPending || !value.referenceId}
            onPress={() =>
              update.mutate({
                action: 'link-billing',
                referenceId: value.referenceId,
              })
            }
            className={buttonClass}
          >
            Link subscription
          </Button>
        </>
      )}
      <View className="flex-row flex-wrap gap-group">
        {inquiry.attention > 0 && (
          <Button
            disabled={update.isPending}
            onPress={() => update.mutate({ action: 'retry-delivery' })}
            className={buttonClass}
          >
            Retry delivery after fixing setup
          </Button>
        )}
        <Button
          disabled={update.isPending}
          onPress={() => update.mutate({ action: 'withdraw' })}
          className={buttonClass}
        >
          {inactive
            ? 'Retry consent suppression'
            : 'Withdraw inquiry and sharing'}
        </Button>
      </View>
      {update.error && (
        <Paragraph role="alert">{update.error.message}</Paragraph>
      )}
      {value.notice && <Paragraph role="status">{value.notice}</Paragraph>}
    </View>
  );
}

export function MarketingInquiries() {
  const { user, activeContext, status } = useAppSession();
  const inbox = useQuery({
    queryKey: marketingKeys.inbox(user?.id, activeContext.orgId),
    enabled: status === 'authed',
    queryFn: async () => {
      const response = await fetch('/api/ops/marketing/inquiries', {
        cache: 'no-store',
      });
      if (!response.ok) throw await responseError(response);
      return marketingInboxResponse.parse(await response.json());
    },
    refetchInterval: 30000,
    retry: false,
  });
  return (
    <Container width="screen" className="gap-stack py-section">
      <Heading level={1}>Moyo inquiries</Heading>
      <Paragraph>
        Adult requests from the Moyo website. Select the Moyo sales workspace to
        manage these records. The latest 100 inquiries are shown.
      </Paragraph>
      {inbox.isPending && (
        <Paragraph role="status">Loading inquiries…</Paragraph>
      )}
      {inbox.error && <Paragraph role="alert">{inbox.error.message}</Paragraph>}
      {inbox.data && (
        <>
          <Heading level={2}>SignalIQ delivery</Heading>
          <Paragraph>
            {inbox.data.configured
              ? 'The server connection is configured. Delivered means SignalIQ confirmed processing; accepted and pending still need confirmation.'
              : 'The server connection needs configuration. Consented inquiries remain saved in Moyo until delivery is enabled.'}
          </Paragraph>
          <View className="gap-group">
            {inbox.data.delivery.map((row) => (
              <Paragraph key={row.state}>
                {row.state}: {row.count}
                {row.last_delivered_at
                  ? ` · Last confirmed ${new Date(row.last_delivered_at).toLocaleString()}`
                  : ''}
              </Paragraph>
            ))}
          </View>
          {inbox.data.inquiries.length === 0 && (
            <Paragraph>No website inquiries have been saved yet.</Paragraph>
          )}
          {inbox.data.inquiries.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </>
      )}
    </Container>
  );
}
