'use client';
// TutorOpening — the tutor session surface BEFORE there is a problem to work on.
//
// This is the screen a child lands on when they open the tutor with nothing
// attached to it, and until now it was the single sentence "No problem
// selected." centred on an empty page: no heading, no exit, nothing to press.
// learner.tutor's contract calls that out by name — "Session with no problem
// context = Natalie opener asking for a snap → snap_next exit; never a blank
// chat" — and its exits are the two rendered here (snap_next → learner.capture,
// end_session → learner.home).
//
// Three states, not one. The old surface collapsed loading, empty and failure
// into the same sentence, so a child could not tell "wait a moment" from "there
// is nothing here" from "this broke". They are separate props of a discriminated
// union so a failure can never render without its retry, and the empty state can
// never render without its way forward.
//
// The register is a child's: no shame, no urgency, no count of what they have
// not done. A failure says the fault is ours, because on a learner surface the
// alternative is a six-year-old concluding they broke it.
//
// EmptyState (the kit block) is deliberately not used: it titles with `Text`,
// which is right INSIDE a page that already has an <h1>, and wrong here. The
// session group is chrome-free — SiteChrome skips `/tutor` — so this surface is
// the whole document and owes it a real heading and a visible exit of its own.
// It borrows TutorStage's shell (hot Dial → SessionToolbar → prose measure) so
// arriving at the session from here is a fill, not a jump.
//
// Mobbin: https://mobbin.com/screens/226fa4f3-a3cb-4c62-ad78-04ad9e6628d4 (Chime
// linked accounts — heading, one supporting sentence, and one full-width primary
// that names the destination rather than nagging) ·
// https://mobbin.com/screens/ff6fd519-92bd-4a84-8727-45907ace1206 (Skyscanner
// recently viewed — the empty body is icon → heading → one line → single wide
// action, which is the whole vertical rhythm this state needs) ·
// https://mobbin.com/screens/e2d7c058-8813-4dad-99f8-c0887f1f270e (Grab empty
// cart — the secondary way out sits under the primary as plain text, so two
// exits never read as two competing buttons) ·
// https://mobbin.com/screens/2419210e-0800-41b0-b0ce-d45c385858cc (Noom can't
// connect — failure keeps the same heading/line/one-action skeleton as the empty
// state instead of becoming a different screen) ·
// https://mobbin.com/screens/428368da-df49-4ae6-9f60-4244315ed039 (MyDyson
// trouble connecting — the dismiss affordance survives the failure state, which
// is the property that keeps this from being a dead end). Structure only; style
// stays on docs 02/08.
// SOT: design/screens/learner/learner.tutor/contract.md (failure_paths.no_data · exits) ·
//      docs/pack/38-front-door-and-flow.md §11 (six states) ·
//      docs/pack/08-visual-hierarchy-spacing-spec.md §2.4
// SOT-KEYWORDS: tutor opening empty loading error state band snap exit dead end no problem selected

import { Button, Dial, Heading, LoadingSkeleton, SessionToolbar, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { Camera, WifiOff } from '@acme/ui/icons';
import { buttonSizeForBand, type AgeBand } from '../capture';

interface OpeningCopy {
  readonly loading: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly errorTitle: string;
  readonly errorBody: string;
  readonly snap: string;
  readonly home: string;
  readonly retry: string;
}

/**
 * Band voice per doc 31 §2.1 — K–2 sentences stay at or under eight words and
 * the reading level drops with the band, while 9–12 gets no artificial
 * simplification. The `home` label tracks each band's own nav word for the
 * learner home ("Today" for K–2/3–5, "Home" for 6–12, per doc 36 §3.1), because
 * an exit that names a place the child has never seen is not an exit they trust.
 */
const OPENING_COPY: Record<AgeBand, OpeningCopy> = {
  young: {
    loading: 'Getting your work ready.',
    emptyTitle: 'Ready when you are',
    emptyBody: 'Show me your homework and we can start.',
    errorTitle: 'That did not load',
    errorBody: 'Something went wrong here. We can try again.',
    snap: 'Snap your homework',
    home: 'Go to Today',
    retry: 'Try again',
  },
  child: {
    loading: 'Getting your work ready.',
    emptyTitle: 'Ready when you are',
    emptyBody: "Take a picture of your homework and we'll start on it together.",
    errorTitle: "That didn't load",
    errorBody: 'Something went wrong on our end, not on yours. Try again in a moment.',
    snap: 'Snap your homework',
    home: 'Back to Today',
    retry: 'Try again',
  },
  teen: {
    loading: 'Finding your next problem.',
    emptyTitle: 'Nothing open right now',
    emptyBody: 'Snap a problem and Natalie will work through it with you.',
    errorTitle: "Couldn't load your next problem",
    errorBody: 'Something went wrong on our end. Your work is safe.',
    snap: 'Snap your homework',
    home: 'Back to home',
    retry: 'Try again',
  },
  adult: {
    loading: 'Finding your next problem.',
    emptyTitle: 'Nothing open right now',
    emptyBody: 'Snap a problem to start a session, or head back home.',
    errorTitle: "Couldn't load your next problem",
    errorBody: 'Something went wrong on our end. Your work is safe.',
    snap: 'Snap your homework',
    home: 'Back to home',
    retry: 'Try again',
  },
};

/**
 * The three pre-session states, as a union rather than a phase string beside
 * optional handlers: a failure with no `onRetry`, or an empty state with no way
 * to snap, are the two shapes this screen must not be able to take.
 */
export type TutorOpeningProps =
  | { phase: 'loading'; ageBand: AgeBand; onHome: () => void }
  | { phase: 'empty'; ageBand: AgeBand; onHome: () => void; onSnap: () => void }
  | { phase: 'error'; ageBand: AgeBand; onHome: () => void; onSnap: () => void; onRetry: () => void };

export function TutorOpening(props: TutorOpeningProps) {
  const { ageBand, onHome } = props;
  const copy = OPENING_COPY[ageBand];
  const young = ageBand === 'young' || ageBand === 'child';
  // The primary is the band's touch target; K–2 goes past `xl` to the 72px
  // young target at the call site, which is where Button.tsx puts that decision
  // because the band comes from the signed-in learner, not from the component.
  const size = buttonSizeForBand(ageBand);
  const primaryClass = ageBand === 'young' ? 'min-h-target-young' : undefined;

  return (
    // `flex-1` on the Dial for the reason TutorStage gives on its own: Dial is a
    // real View, so it is a link in the flex chain and the surface collapses to
    // content height without it.
    <Dial temperature="hot" className="flex-1">
      <View className="flex-1 gap-stack bg-surface">
        {/* The exit that is always there, in the place the session itself puts
            it — back from a session with nothing in it is the learner home
            (contract exits.end_session), not browser history, which on a cold
            open of /tutor goes nowhere. */}
        <SessionToolbar title="Natalie" onBack={onHome} />
        <View className="mx-auto w-full max-w-content-prose flex-1 justify-center gap-group p-inset">
          {props.phase === 'loading' ? (
            <View className="gap-stack" aria-busy>
              <Text variant="body" tone="muted">
                {copy.loading}
              </Text>
              {/* The shape of the thread that is about to arrive, so the wait
                  reads as this screen filling in rather than as a blank one. */}
              <LoadingSkeleton variant="card" />
              <LoadingSkeleton count={2} />
            </View>
          ) : (
            <>
              <View className="gap-element">
                <View
                  aria-hidden
                  className="h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-sunken"
                >
                  {props.phase === 'error' ? (
                    <WifiOff className="h-8 w-8 text-text-muted" />
                  ) : (
                    <Camera className="h-8 w-8 text-text-muted" />
                  )}
                </View>
                <Heading level={1} size={young ? 'display-md' : 'display-sm'}>
                  {props.phase === 'error' ? copy.errorTitle : copy.emptyTitle}
                </Heading>
                <Text variant="body" tone="muted">
                  {props.phase === 'error' ? copy.errorBody : copy.emptyBody}
                </Text>
              </View>

              {/* One primary. On the failure the primary is the retry — the
                  thing the child came for is still the most likely to work —
                  and snapping drops to the quiet row beside the exit, so the
                  screen never offers two equally loud choices. */}
              <View className="gap-stack">
                {props.phase === 'error' ? (
                  <Button
                    title={copy.retry}
                    variant="primary"
                    size={size}
                    fullWidth
                    className={primaryClass}
                    onPress={props.onRetry}
                  />
                ) : (
                  <Button
                    title={copy.snap}
                    variant="highlighter"
                    size={size}
                    fullWidth
                    className={primaryClass}
                    onPress={props.onSnap}
                  />
                )}
                {/* Full-width ghosts, stacked. A `self-start` ghost sits at its
                    own padding inset rather than at the primary's border, so the
                    exit read as indented from the button above it — the one
                    misalignment on a screen whose whole job is looking like a
                    place someone meant to build. */}
                {props.phase === 'error' ? (
                  <Button
                    title={copy.snap}
                    variant="ghost"
                    size={size}
                    fullWidth
                    onPress={props.onSnap}
                  />
                ) : null}
                <Button title={copy.home} variant="ghost" size={size} fullWidth onPress={onHome} />
              </View>
            </>
          )}
        </View>
      </View>
    </Dial>
  );
}
