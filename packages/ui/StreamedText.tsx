'use client';
// StreamedText — renders a string as if tokens are arriving one at a time.
// SOT: docs/pack/15-native-ai-client-spec.md §1
// SOT-KEYWORDS: streamed text chat tutor stream message ui

import { useEffect, useState } from 'react';
import { Text } from './primitives';

export interface StreamedTextProps {
  children: string;
  intervalMs?: number;
  className?: string;
  onComplete?: () => void;
}

export function StreamedText({ children, intervalMs = 18, className, onComplete }: StreamedTextProps) {
  const [visible, setVisible] = useState(0);
  const [source, setSource] = useState(children);

  // Adjusting state during render, which is React's documented alternative to
  // a prop-syncing effect and the reason this is not one.
  //
  // Text that grew is a stream still arriving, so the reveal continues from
  // where it is; only a genuinely different string restarts it. Restarting on
  // every prop change — which is what this did when the only streaming was
  // simulated — would make each arriving sentence retype the whole turn from
  // the first character.
  if (source !== children) {
    setSource(children);
    if (!children.startsWith(source)) setVisible(0);
  }

  useEffect(() => {
    if (visible >= children.length) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setVisible((v) => (v >= children.length ? v : v + 1));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [children, intervalMs, visible, onComplete]);

  return <Text className={className}>{children.slice(0, visible)}</Text>;
}
