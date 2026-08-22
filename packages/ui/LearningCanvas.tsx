import type { ReactNode } from 'react';
// LearningCanvas — equation/whiteboard workspace for the S9 tutor session.
// Pure presentation: depends only on @acme/theme, never on a domain.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · doc 10-types-components-spec.md
// SOT-KEYWORDS: learningcanvas workspace whiteboard equation canvas

import { View } from './primitives';

export interface LearningCanvasProps {
  children?: ReactNode;
  className?: string;
}

export function LearningCanvas({ children, className }: LearningCanvasProps) {
  return (
    <View
      className={`flex-1 rounded-card border-2 border-strong bg-surface-raised p-inset ${className ?? ''}`}>
      {children}
    </View>
  );
}
