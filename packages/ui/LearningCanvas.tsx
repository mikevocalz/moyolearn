// LearningCanvas — the workspace sheet the S9 tutor session draws on.
// Pure presentation: depends only on @acme/theme, never on a domain.
//
// It stayed an empty bordered box for months, which
// `docs/design/reset/00-repo-baseline.md:34` records as deliberate: it is the
// MOUNT POINT for the drawing surface, and "the new work is the renderer, not
// another container". `Whiteboard` is that renderer, and it is the first thing
// ever mounted here.
//
// `padded` exists for it. A canvas has to run edge to edge — a drawing engine
// sizes its own canvas element to this box, so an inset would leave a border of
// dead paper the pen cannot reach — while every other use of the sheet wants
// the page inset. A variant rather than a `className` override, because the
// base string is not merged and `p-inset p-0` would resolve by stylesheet order
// rather than by intent.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · doc 10-types-components-spec.md
// SOT-KEYWORDS: learningcanvas workspace whiteboard equation canvas mount point

import type { ReactNode } from 'react';
import { tv, type VariantProps } from './tv';
import { View } from './primitives';

const learningCanvas = tv({
  base: 'flex-1 rounded-card border-2 border-strong bg-surface-raised',
  variants: {
    padded: { true: 'p-inset', false: 'overflow-hidden p-0' },
  },
  defaultVariants: { padded: true },
});

export interface LearningCanvasProps extends VariantProps<typeof learningCanvas> {
  children?: ReactNode;
  className?: string;
}

export function LearningCanvas({ children, padded, className }: LearningCanvasProps) {
  return <View className={learningCanvas({ padded, className })}>{children}</View>;
}
