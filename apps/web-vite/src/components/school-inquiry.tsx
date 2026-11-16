/**
 * Adult inquiry capture in the existing schools chapter, with explicit choices.
 * SOT: docs/site/signaliq-business-connection.md · docs/site/signaliq-inquiry/DIRECTION.md
 * SOT-KEYWORDS: school inquiry contact form consent signaliq marketing
 */
import { useMemo, useRef } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Button, Input, Label, Paragraph, View } from '@acme/ui/primitives';
import { Container, Heading } from '@acme/ui/typography';
import { APP_ORIGIN } from '@/app-links';

const inputClass =
  'w-full rounded-moyo-card border border-moyo-ink bg-moyo-paper px-4 py-3 text-site-body text-moyo-ink';
export function SchoolInquiry() {
  const state = useMemo(
    () =>
      createStore(() => ({
        name: '',
        email: '',
        audience: 'school',
        organizationName: '',
        organizationDomain: '',
        adult: false,
        contactConsent: false,
        signalConsent: false,
        busy: false,
        message: '',
        error: '',
        saved: false,
      })),
    [],
  );
  const value = useStore(state);
  const pending = useRef<{ requestId: string; body: string } | null>(null);
  const textField = (
    key: 'name' | 'email' | 'organizationName' | 'organizationDomain',
    label: string,
  ) => (
    <Label className="flex flex-col gap-group text-site-body font-semibold text-moyo-ink">
      {label}
      <Input
        aria-label={label}
        inputMode={key === 'email' ? 'email' : 'text'}
        value={value[key]}
        autoComplete={
          key === 'name'
            ? 'name'
            : key === 'email'
              ? 'email'
              : key === 'organizationName'
                ? 'organization'
                : 'off'
        }
        onChangeText={(text) => {
          pending.current = null;
          state.setState({ [key]: text });
        }}
        onSubmitEditing={() => void submit()}
        className={inputClass}
        editable={!value.busy && !value.saved}
      />
    </Label>
  );
  const choice = (
    key: 'adult' | 'contactConsent' | 'signalConsent',
    label: string,
  ) => (
    <Button
      role="checkbox"
      aria-checked={value[key]}
      aria-label={label}
      onPress={() => {
        pending.current = null;
        state.setState({ [key]: !value[key] });
      }}
      disabled={value.busy || value.saved}
      className="flex-row items-start gap-group rounded-moyo-card border border-moyo-ink px-4 py-3 text-left text-site-body text-moyo-ink"
    >
      <Paragraph aria-hidden className="text-site-body text-moyo-ink">
        {value[key] ? '☑' : '☐'}
      </Paragraph>
      <Paragraph className="flex-1 text-site-body text-moyo-ink">
        {label}
      </Paragraph>
    </Button>
  );
  async function submit() {
    if (value.busy || value.saved) return;
    if (
      !value.name.trim() ||
      !/^\S+@\S+\.\S+$/.test(value.email) ||
      value.email.length > 254 ||
      !value.adult ||
      !value.contactConsent ||
      (value.audience !== 'parent' && !value.organizationName.trim())
    ) {
      state.setState({
        error:
          'Enter your contact details and confirm the two required choices.',
      });
      return;
    }
    if (!pending.current) {
      const requestId = crypto.randomUUID();
      pending.current = {
        requestId,
        body: JSON.stringify({
          requestId,
          name: value.name,
          email: value.email,
          audience: value.audience,
          organizationName:
            value.audience === 'parent' ? '' : value.organizationName,
          organizationDomain:
            value.audience === 'parent' ? '' : value.organizationDomain,
          adult: value.adult,
          contactConsent: value.contactConsent,
          signalConsent: value.signalConsent,
        }),
      };
    }
    state.setState({ busy: true, error: '', message: '' });
    try {
      const response = await fetch(`${APP_ORIGIN}/api/marketing/inquiries`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: pending.current.body,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        state.setState({
          error:
            response.status === 429
              ? 'Too many requests. Please try again later.'
              : 'Your inquiry was not confirmed. Your details are still here; try again.',
        });
        return;
      }
      const result = await response.json();
      if (result.accepted !== true || typeof result.id !== 'string') {
        state.setState({
          error: 'We could not confirm the saved inquiry. Please retry.',
        });
        return;
      }
      state.setState({
        saved: true,
        message:
          'Your inquiry is saved. Moyo has your contact details and request. This does not book a call yet.',
      });
    } catch {
      state.setState({
        error:
          'We could not confirm the response. Retry with the same details to avoid a duplicate inquiry.',
      });
    } finally {
      state.setState({ busy: false });
    }
  }
  return (
    <Container
      id="request-demo"
      width="detail"
      className="gap-stack py-section"
    >
      <Heading
        level={2}
        className="font-moyo-text text-site-subtitle text-moyo-ink"
      >
        Talk to Moyo
      </Heading>
      <Paragraph className="text-site-body text-moyo-ink">
        Tell us how to reach you about your school, tutoring business, or family
        plan. Please use your own adult contact details.
      </Paragraph>
      <View className="gap-stack" role="form" aria-label="Moyo inquiry">
        {textField('name', 'Your name')}
        {textField('email', 'Your email')}
        <View
          className="gap-group"
          role="radiogroup"
          aria-label="I’m interested in Moyo for"
        >
          <Paragraph className="text-site-body font-semibold text-moyo-ink">
            I’m interested in Moyo for
          </Paragraph>
          {[
            ['school', 'A school or district'],
            ['tutoring-business', 'A tutoring business'],
            ['parent', 'My family'],
          ].map(([audience, label]) => (
            <Button
              key={audience}
              role="radio"
              aria-checked={value.audience === audience}
              onPress={() => {
                pending.current = null;
                state.setState({ audience });
              }}
              disabled={value.busy || value.saved}
              className={`${inputClass} text-left`}
            >
              {value.audience === audience ? '●' : '○'} {label}
            </Button>
          ))}
        </View>
        {value.audience !== 'parent' && (
          <>
            {textField('organizationName', 'School or business name')}
            {textField('organizationDomain', 'Website domain (optional)')}
          </>
        )}
        {choice('adult', 'I am 18 or older. (Required)')}
        {choice(
          'contactConsent',
          'Moyo may use these details to respond to my inquiry. (Required)',
        )}
        {choice(
          'signalConsent',
          'Also let Moyo use SignalIQ to organize this inquiry and its business follow-ups. (Optional)',
        )}
        <Paragraph className="text-site-body text-moyo-ink">
          No student information or learning activity is requested. You can
          withdraw your inquiry or optional sharing by contacting Moyo.
        </Paragraph>
        {value.error && (
          <Paragraph role="alert" className="text-site-body text-moyo-ink">
            {value.error}
          </Paragraph>
        )}
        {value.message && (
          <Paragraph role="status" className="text-site-body text-moyo-ink">
            {value.message}
          </Paragraph>
        )}
        <Button
          onPress={() => void submit()}
          disabled={value.busy || value.saved}
          className="self-start rounded-moyo-card bg-moyo-ink px-6 py-3 text-site-body text-moyo-paper"
        >
          {value.busy
            ? 'Saving inquiry…'
            : value.saved
              ? 'Inquiry saved'
              : 'Send inquiry'}
        </Button>
      </View>
    </Container>
  );
}
