// visionOS uses the system spatial keyboard; UIKit input accessory views are unavailable.
// SOT-KEYWORDS: keyboard provider visionos spatial keyboard app root
import type { PropsWithChildren } from 'react';

export function KeyboardProvider({ children }: PropsWithChildren) {
  return children;
}
