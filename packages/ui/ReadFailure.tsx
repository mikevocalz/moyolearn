// ReadFailure — the one block a screen renders when a read did not land.
//
// It exists because "there is nothing here" and "we could not check whether
// there is anything here" are different sentences, and only the first one is
// calm. Six surfaces had written their own version of the second sentence (or,
// worse, rendered the first one on a failure), so the shape drifted and one
// screen skipped it entirely — `EmptyState` was doing double duty as both.
// This is the split made structural: `EmptyState` may only claim an answered
// zero, and anything else routes here.
//
// Composed over `EmptyState` rather than forked from it (CLAUDE.md §UI): same
// centred icon/title/description bones, plus the two things a failure owes and
// an empty state must not have — a visible NOT-LOADED marker so the state is
// legible before the copy is read, and a retry that re-runs the read in place.
//
// Tone: `attention`, never `danger` (doc 08 §4.8). A read that failed is not an
// emergency, and on a family surface red means something happened to a child.
// A second, still-working exit may ride under the retry so the screen is never
// a dead end while the read is down.
//
// Mobbin: https://mobbin.com/screens/b719158e-0a19-4b2e-8cc0-5217648ea20a
// (Revolut Business — the failure occupies ONLY the region that failed: nav,
// header and filters stay put while the content column carries icon + "Connection
// issue" + Try again) ·
// https://mobbin.com/screens/67dd3c10-992c-4ce7-a4fb-72a9857818cc
// (Klaviyo — title, one plain reassurance line, single retry, stacked and
// centred in the content column) ·
// https://mobbin.com/screens/33a0fa06-a623-4e22-b705-4175ce2216a9
// (Remote — icon above a two-line explanation, one Retry beneath) ·
// https://mobbin.com/screens/71044211-2f4a-4b72-a66f-867a5ea94b35
// (PayPal — the "trying again may help" reassurance sits between title and the
// retry, so the action reads as worth taking) ·
// https://mobbin.com/screens/f7e56d77-8f37-4741-8f7b-9fa1b2c0ddf4
// (Skiff — a second route out stacked under the primary recovery action).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.8 · packages/ui/EmptyState.tsx
// SOT-KEYWORDS: read failure error state retry not loaded honest failed read empty state split

import type { ReactNode } from 'react';
import { View } from './primitives';
import { Badge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { TriangleAlert } from './icons';

export interface ReadFailureProps {
  /** What could not be read, in the reader's words — "We couldn't load your alerts." */
  title: string;
  /**
   * Why nothing is lost. A failed read is frightening on a family surface
   * precisely because the reader cannot tell it apart from bad news, so this
   * line is required, not optional.
   */
  description: string;
  /** Re-runs the same read in place. Never a page reload. */
  onRetry: () => void;
  /** An exit that still works while this read is down — optional by nature. */
  action?: ReactNode;
  className?: string;
}

export function ReadFailure({
  title,
  description,
  onRetry,
  action,
  className,
}: ReadFailureProps) {
  return (
    <EmptyState
      className={className}
      icon={<TriangleAlert size={28} className="text-text-muted" />}
      title={title}
      description={description}
      action={
        <View className="items-center gap-stack">
          {/* The marker reads before the copy does — the one thing that tells a
              scanning eye this region is broken rather than empty. */}
          <Badge label="Not loaded" tone="attention" />
          <View className="flex-row flex-wrap items-center justify-center gap-stack">
            <Button title="Try again" variant="outline" onPress={onRetry} />
            {action}
          </View>
        </View>
      }
    />
  );
}
