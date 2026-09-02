'use client';
// Institution placeholder — the landing for an institutional route whose
// surface is not built yet (school.academics today).
//
// Two things changed here, and both are the same rule. First, the screen
// carries a WAY OUT to school.home: the school.academics contract's
// back_behavior says "while unbuilt, direct-URL visitors must get a way out
// (→ school.home)", and a titled page with one sentence and no door is the
// designed dead end that contract exists to close — nav.ts already pulled the
// rail item, so everyone who arrives here typed or followed a link and has
// nowhere to go next by construction.
//
// Second, it takes the org as a CLASSIFIED read. The org name used to arrive
// as `OrgBranding | null` with every refusal thrown past it, so a correct
// permission answer and an unconfirmable session both rendered the route
// group's "Something broke on our end" error page instead of this screen.
// `denied` never reaches here — the page turns it into a silent not-found
// (contract permission path) — and `unavailable` renders the title without
// the school's name rather than under it, because a branded heading over a
// read that did not complete is a confidence the page has not earned.
// SOT: design/screens/school/school.academics/contract.md · packages/app/features/institution/institution.service.ts
// SOT-KEYWORDS: institution placeholder screen unbuilt exit school home read union unavailable dead end
// Mobbin: https://mobbin.com/screens/307b3bb3-0556-4754-a57f-9d3b24116e20 (Whop
//   — an unavailable page renders INSIDE the product shell as a centred block:
//   icon, one sentence, one action; the rail stays put) ·
//   https://mobbin.com/screens/d7bd8728-f0a0-494c-887a-d6c5a56f7270 (Maze —
//   "Study not available": title, one explanatory line, a single way back) ·
//   https://mobbin.com/screens/dff672c8-505a-46a3-a637-c3c7a01d0ed6 (Remote —
//   two exits sit side by side beneath the sentence, weighted primary and
//   secondary rather than stacked) ·
//   https://mobbin.com/screens/0cb8a748-4514-4f27-b102-194649e40112 (Mercor —
//   headline, one supporting line, a go-home action beside a quieter second
//   option, all left of a wide empty field). Structure only.

import { useRouter } from 'solito/navigation';
import { Button, Container, EmptyState, Heading, SafeArea } from '@acme/ui';
import { Compass } from '@acme/ui/icons';
import { View, Text as TWText } from '@acme/ui/tw';
import type { OrgBranding } from '../org/org.service.ts';
import type { InstitutionRead } from './institution.types.ts';

export interface InstitutionPlaceholderScreenProps {
  title: string;
  description: string;
  /** The org read. `unavailable` suppresses the name; `ok` may still be null. */
  org: InstitutionRead<OrgBranding | null>;
  /**
   * This shell's home — the contract's roll-up exit. A STRING, not a handler:
   * every caller is a server component, and a function cannot cross that
   * boundary, so the target travels as data and the navigation happens here.
   * Defaults to the rail root, which is where both institutional shells put
   * Overview.
   */
  homeHref?: string;
  /** Label for the exit, so a district and a school name their own home. */
  homeLabel?: string;
}

export function InstitutionPlaceholderScreen({
  title,
  description,
  org,
  homeHref = '/',
  homeLabel = 'Back to Overview',
}: InstitutionPlaceholderScreenProps) {
  const router = useRouter();
  const name = org.state === 'ok' ? org.data?.name : undefined;
  const displayTitle = name ? `${name} — ${title}` : title;

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {displayTitle}
          </Heading>
          <TWText className="text-body text-text-muted">{description}</TWText>

          {/*
            The exit, stated as a state rather than tucked under the sentence:
            this page's whole content is "not here yet", so the block that says
            so is the page body, and the door belongs in it.
          */}
          <EmptyState
            // A kit icon, not a typed glyph: the rest of the product's empty
            // and failure states are lucide marks at 28, and a lone character
            // in a box reads as a rendering fault rather than an illustration.
            icon={<Compass size={28} className="text-text-muted" />}
            title="Nothing to do here yet"
            description="This surface isn’t built. Nothing is broken and nothing is missing from your school — there is simply no page behind this address yet."
            action={
              <Button
                title={homeLabel}
                variant="outline"
                onPress={() => router.push(homeHref)}
              />
            }
          />
        </View>
      </Container>
    </SafeArea>
  );
}
