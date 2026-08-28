// TwoPaneShell at both width classes and both colour schemes — the collapse law
// (doc 37 §3.1) is the thing on trial here, so every story is the SAME shell and
// the SAME form, differing only in the viewport and the scheme it is read in.
//
// Resizing the Storybook canvas across 768 shows the crossing live; the paired
// `Compact*` / `Regular*` stories pin both sides of it so a regression shows up
// as a story that stopped matching its name.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.1
// SOT-KEYWORDS: two pane shell stories auth login brand band collapse compact regular light dark
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TwoPaneShell, type TwoPaneBrand } from './TwoPaneShell';
import { Button } from './Button';
import { Heading } from './Heading';
import { TextField } from './TextField';
import { View } from './primitives';
import { useInstanceStore, useStore } from './use-instance-store';

/*
  `fullscreen` plus a viewport-tall wrapper, because the shell is a `flex-1`
  screen root and a flex root fills a parent that has a height. In the app that
  parent is `<body class="flex min-h-dvh flex-col">`; Storybook's root has no
  height of its own, so without this the shell collapses to content height and
  the story stops showing the layout it exists to show.
*/
const meta = {
  title: 'UI/TwoPaneShell',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story: () => React.ReactNode) => <View className="min-h-screen">{Story()}</View>,
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The shipped tagline (doc 02 Addendum B) — the one line that survives the collapse. */
const MOYO: TwoPaneBrand = {
  tagline: 'Learn it by heart.',
  supporting:
    'AI tutoring that helps a child learn it by heart — and helps the parents, tutors, and teachers around them help better.',
};

const DISTRICT: TwoPaneBrand = {
  tagline: 'Learn it by heart.',
  supporting: 'Moyo, for Riverside Unified.',
  org: {
    name: 'Riverside Unified',
    logoUrl: 'https://picsum.photos/seed/riverside/240/180',
    logoAspect: 'wide',
  },
};

/**
 * The form pane — the shell's only node slot, and so the only place a control
 * can be. Field state is a per-mount store, never React state (repo rule): a
 * module-level store would share one email box between two mounted stories.
 */
function SignInForm() {
  const store = useInstanceStore(() => ({ email: '', password: '' }));
  const { email, password } = useStore(store, (s) => s);
  const patch = (next: Partial<{ email: string; password: string }>) =>
    store.setState((s) => ({ ...s, ...next }));

  return (
    <>
      <Heading level={1} size="display-sm">Sign in</Heading>
      <View className="gap-group">
        <TextField
          label="Email"
          value={email}
          onChangeText={(email: string) => patch({ email })}
          inputMode="email"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
        />
        <TextField
          label="Password"
          hint="At least 12 characters."
          value={password}
          onChangeText={(password: string) => patch({ password })}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
        <Button fullWidth title="Sign in" />
      </View>
      <Button fullWidth variant="ghost" title="Need an account? Sign up" />
    </>
  );
}

/** Regular (≥768): brand pane left, form right, divider between them. */
export const Regular: Story = {
  render: () => (
    <TwoPaneShell brand={MOYO}>
      <SignInForm />
    </TwoPaneShell>
  ),
};

/** The same shell read in dark. Both slabs re-point; the divider stays ink. */
export const RegularDark: Story = {
  ...Regular,
  globals: { theme: 'dark' },
};

/**
 * Compact (<768): the pane has become a band — mark plus the ONE tagline line,
 * the supporting sentence and the imagery dropped, the form immediately under
 * it. Nothing pressable was in the pane, so nothing was lost in the collapse.
 */
export const Compact: Story = {
  ...Regular,
  globals: { viewport: 'phone' },
};

export const CompactDark: Story = {
  ...Regular,
  globals: { viewport: 'phone', theme: 'dark' },
};

/** A district's door: both marks at equal weight, the district named in the pane. */
export const CoBranded: Story = {
  render: () => (
    <TwoPaneShell brand={DISTRICT}>
      <SignInForm />
    </TwoPaneShell>
  ),
};

/** The same district on a phone — the partner mark survives, its sentence does not. */
export const CoBrandedCompact: Story = {
  ...CoBranded,
  globals: { viewport: 'phone' },
};

/**
 * The imagery slot (doc 37 §3.1's photography / Natalie still). Pane-only by
 * construction: a band tall enough to hold a picture is a screen, not a band —
 * compare with `Compact`, where the same brand renders without it.
 */
export const WithImagery: Story = {
  render: () => (
    <TwoPaneShell
      brand={{
        ...MOYO,
        image: { src: 'https://picsum.photos/seed/moyo-tutor/720/720', alt: 'A tutor and a learner working through a problem together' },
      }}
    >
      <SignInForm />
    </TwoPaneShell>
  ),
};

/** Imagery on a phone: the slot is gone, the band is still one line tall. */
export const WithImageryCompact: Story = {
  ...WithImagery,
  globals: { viewport: 'phone' },
};
