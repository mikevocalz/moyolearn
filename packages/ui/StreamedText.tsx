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

  useEffect(() => {
    setVisible(0);
  }, [children]);

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
