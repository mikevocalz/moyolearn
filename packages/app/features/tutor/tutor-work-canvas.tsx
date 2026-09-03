'use client';
// TutorWorkCanvas — what fills the second pane at tablet and unfolded width.
//
// WHY THIS EXISTS: doc 23 §5 specifies a two-column session at ≥600dp —
// "Left: presence + her turn. Right: LearningCanvas (equation/whiteboard)" —
// and `TutorStage` has carried that branch for months behind
// `canvas !== undefined`. Nothing ever passed a canvas, so the condition was
// permanently false: a tablet, and an unfolded Surface Duo reporting 1080dp,
// ran the whole session as one narrow column with the rest of the window blank.
// The layout was built and unreachable. This is the content that earns it.
//
// WHAT EARNS THE PANE, and what does not: the child's OWN work. The problem
// they typed or photographed, at a size you can read across a desk, plus the
// photo they took of it. Not a scratchpad we cannot save, not a hint list that
// duplicates the thread, and not a progress widget — doc 23 §5 names
// `StruggleMeter` and `SessionPrepCard` as things that never appear on a
// child's screen. A second pane holding anything other than the thing they are
// stuck on would be the empty-box problem again with extra steps.
//
// It renders NOTHING when there is no problem and no photo. `TutorStage` reads
// that as "no canvas" and returns to the single spine, which is the honest
// answer: an empty workspace is not a workspace.
//
// Mobbin: https://mobbin.com/screens/9ab613b6-0e0e-44f3-ab47-77fd1f1fdad7
// (Duolingo — the material under discussion holds a fixed region and the
// dialogue happens beside/below it, never on top of it) ·
// https://mobbin.com/screens/433fb29c-cb3b-41af-9508-e8562b34b88b (Mimo — the
// work is the large pane and the tutor docks to a strip, which is the exact
// weighting a homework session needs at width). Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · §4.2 ·
//      docs/design/tutor-session-responsive-spec.md §2 (Tablet)
// SOT-KEYWORDS: tutor work canvas second pane split view equation problem photo tablet foldable

import { ImageViewer, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { SolitoImage } from 'solito/image';
import type { TutorAttachment, TutorMessage } from '@acme/ui';

export interface TutorWorkCanvasProps {
  /** The problem the session is about — typed, pasted, or read off a photo. */
  problem: string | null;
  /** The conversation, read only for the pictures the learner has sent. */
  messages: readonly TutorMessage[];
}

/** True when there is something worth giving half the window to. */
export function hasWorkToShow(problem: string | null, messages: readonly TutorMessage[]): boolean {
  return (problem !== null && problem.trim().length > 0) || learnerImages(messages).length > 0;
}

/*
  The learner's photos only. Natalie does not send pictures today, but the
  filter is on `role` rather than on who happens to have attachments, because
  the pane is titled "your work" and a diagram she sent later would not be.
*/
function learnerImages(messages: readonly TutorMessage[]): readonly TutorAttachment[] {
  return messages
    .filter((m) => m.role === 'learner')
    .flatMap((m) => (m.attachments ?? []).filter((a) => a.kind === 'image'));
}

export function TutorWorkCanvas({ problem, messages }: TutorWorkCanvasProps) {
  const images = learnerImages(messages);
  const text = problem?.trim() ?? '';
  if (text.length === 0 && images.length === 0) return null;

  const uris = images.map((a) => a.previewUri ?? a.uri);

  return (
    <View className="flex-1 gap-group">
      <Text className="font-sans text-caption text-text-muted">What we&apos;re working on</Text>
      {text.length > 0 ? (
        /*
          Mono and tabular, because the content is arithmetic and a proportional
          face puts `1` and `7` on different widths down a column of working.
          `display-md` rather than doc 23 §4.2's resolved 44px: the mobile
          bundler sets `polyfills.rem = 14` (see the note on `targets` in
          tokens.ts), so this lands at ~36px on web and ~32px on device — the
          readable-across-a-desk size the doc is after, expressed as a token
          instead of the number that token happened to resolve to on the canvas.
        */
        <Text className="font-mono text-display-md text-text" aria-label="The problem">
          {text}
        </Text>
      ) : null}
      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-stack">
          {images.map((image, index) => (
            <ImageViewer key={image.id} urls={uris} index={index}>
              {/* Single child: the viewer animates this element into the
                  full-screen view, so the thumbnail is the shared element. */}
              <View className="h-40 w-56 overflow-hidden rounded-control border-2 border-border">
                {/* `contain` for the reason TutorThread gives: a homework photo
                    is wide and cropping to the centre hides which problem it is. */}
                <SolitoImage
                  src={image.previewUri ?? image.uri}
                  alt={image.name}
                  fill
                  unoptimized
                  contentFit="contain"
                  sizes="224px"
                />
              </View>
            </ImageViewer>
          ))}
        </View>
      ) : null}
    </View>
  );
}
