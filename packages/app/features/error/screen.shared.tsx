'use client';
// ONE error surface for Expo `+not-found` AND Next `not-found`/`error`.
// Signature: a sheet torn out of an exercise book — punched holes, ruled lines,
// the status number written on the rules. The school-supplies vernacular has an
// answer for "this page is missing" and it is not a centred stack of grey text.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §3.2 (hierarchy recipe)
// SOT-KEYWORDS: error screen 404 not-found failure boundary ruled paper sheet
import { View, H1, Text } from '@acme/ui/tw';
import { Container, Button, FadeIn, ScaleIn } from '@acme/ui';

export interface ErrorScreenProps {
  /** 404 vs generic failure. */
  kind?: 'not-found' | 'error';
  /**
   * A support reference — Next's `error.digest`, never `error.message`.
   * Raw exception text on a surface a child can reach is both unreadable and a
   * leak; a digest is the thing support can actually look up.
   */
  reference?: string;
  onGoHome?: () => void;
  onGoBack?: () => void;
  /** Present only when the caller has an error boundary to reset. */
  onRetry?: () => void;
}

const COPY = {
  'not-found': {
    mark: '404',
    title: "This page isn't in the book",
    body: 'The link may be out of date, or the page moved somewhere else.',
  },
  error: {
    mark: '!',
    title: 'Something broke on our end',
    body: "We've logged it. Try again, or head back to where you started.",
  },
} as const;

/*
  The sheet is built from real elements, not a background gradient: this screen
  renders on native too, and React Native has no repeating-linear-gradient.
  Seven rules and four holes is what reads as "a page" at every width we ship —
  a count, not a measurement, so nothing here needs an arbitrary value.
*/
const RULES = [0, 1, 2, 3, 4, 5, 6];
const HOLES = [0, 1, 2, 3];

function TornSheet({ mark }: { mark: string }) {
  return (
    /*
      Tilted so it reads as a loose sheet on a desk rather than as one more
      bordered card in a stack of bordered cards — with a border on everything,
      the only way this artefact separates from the frame is that it is askew.
      aria-hidden: the number is decoration, and the <h1> beside it already
      says what happened.
    */
    <ScaleIn
      aria-hidden
      className="relative w-full max-w-content-form rotate-2 justify-center rounded-card border-2 border-border bg-surface-raised p-inset-roomy shadow-raised"
    >
      {/* Ruled lines sit behind the number, so the number sits ON the paper. */}
      <View className="pointer-events-none absolute inset-0 justify-between p-inset-roomy">
        {RULES.map((i) => (
          <View key={i} className="h-px w-full bg-border-faint" />
        ))}
      </View>

      {/* Punched holes down the binding edge — the tell that it was torn out. */}
      <View className="pointer-events-none absolute inset-y-0 left-0 justify-evenly pl-element">
        {HOLES.map((i) => (
          <View key={i} className="h-3 w-3 rounded-full border-2 border-border bg-surface" />
        ))}
      </View>

      <Text className="pl-group text-center font-display text-display-xl text-text">{mark}</Text>
    </ScaleIn>
  );
}

export function ErrorScreen({
  kind = 'not-found',
  reference,
  onGoHome,
  onGoBack,
  onRetry,
}: ErrorScreenProps) {
  const copy = COPY[kind];

  return (
    <View className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 justify-center bg-surface py-section">
      <Container width="wide">
        {/*
          Asymmetric on purpose. A centred stack is the shape every 404 on the
          internet already has, and it gives the eye nothing to land on first.
          Copy leads on desktop; the sheet leads on phones, where the artefact
          says something is wrong before you have read a word.
        */}
        <View className="flex-col-reverse items-center gap-group lg:flex-row lg:items-center lg:justify-between lg:gap-section">
          <FadeIn className="w-full max-w-content-form items-start gap-stack">
            {/*
              One display moment per screen (§3.2) and the sheet has it, so the
              heading wins on position and the space around it rather than on
              size — the hierarchy recipe in that order. H1 from tw, not the kit
              Heading, because the kit's base is `font-display`: Archivo Black
              here would be the second display moment.
            */}
            <H1 className="font-sans text-title-lg font-semibold text-text">{copy.title}</H1>
            <Text className="text-body text-text-muted">{copy.body}</Text>

            {/*
              Two actions, because a 404 and a crash have different fixes: most
              404s come from a stale link, where going back is the real remedy,
              and a crash is worth one retry before you give up on the route.
              The yellow primary is this screen's single accent — nothing else
              may take it (§3.2).
            */}
            <View className="flex-row flex-wrap items-center gap-element pt-element">
              {kind === 'error' && onRetry ? (
                <>
                  <Button title="Try again" onPress={onRetry} />
                  <Button title="Back to home" variant="outline" onPress={onGoHome} />
                </>
              ) : (
                <>
                  <Button title="Back to home" onPress={onGoHome} />
                  {onGoBack ? (
                    <Button title="Go back" variant="outline" onPress={onGoBack} />
                  ) : null}
                </>
              )}
            </View>

            {/*
              The reference is what turns "it broke" into something support can
              act on, so it is legible and quotable rather than buried in a
              console. `data` mono because it is a code, and codes are read
              character by character.
              ponytail: no copy button — that costs a clipboard dependency on
              native for a string short enough to read aloud. Add expo-clipboard
              the first time someone asks.
            */}
            {reference ? (
              <View className="mt-stack w-full gap-element border-t-2 border-border-faint pt-stack">
                <Text className="text-caption text-text-muted">Reference</Text>
                <Text className="font-mono text-data text-text">{reference}</Text>
              </View>
            ) : null}
          </FadeIn>

          <TornSheet mark={copy.mark} />
        </View>
      </Container>
    </View>
  );
}
