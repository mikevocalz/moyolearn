'use client';
// The dial: one DNA, two temperatures (doc 02 §5.3).
// Hot = learner/family surfaces, Cool = ops/educator/institution.
// SOT: docs/pack/02-adaptive-screens-design-spec.md §5.3 · packages/theme/tokens.ts `dial`
// SOT-KEYWORDS: dial hot cool temperature density scope surface learner ops
import type { ReactNode } from 'react';
import { View } from './tw';

export type DialTemperature = 'hot' | 'cool';

export interface DialProps {
  /**
   * Cool is the default on purpose: doc 02 Addendum A.3 takes minimalism as
   * "the better default for dense products", with neubrutalism as the
   * expressive overlay. A surface opts INTO warmth.
   */
  temperature?: DialTemperature;
  children: ReactNode;
  className?: string;
}

const SCOPE: Record<DialTemperature, string> = {
  hot: 'dial-hot',
  cool: 'dial-cool',
};

/**
 * Re-points the chrome tokens for everything inside it, so components need no
 * dial prop of their own — both engines inherit custom properties down the tree.
 *
 * Nest to express a mixed surface, which is exactly how doc §5.3 describes the
 * parent shells ("cool structure, hot accents on child-related cards"):
 *
 *   <Dial temperature="cool">        …ops chrome…
 *     <Dial temperature="hot">       …this child card runs warm…
 *
 * Does not carry border WIDTH — `border-2` is a literal, not a variable. That
 * row of the §5.3 table lands with the Wave-2 component variants.
 */
export function Dial({ temperature = 'cool', children, className }: DialProps) {
  return <View className={`${SCOPE[temperature]}${className ? ` ${className}` : ''}`}>{children}</View>;
}
