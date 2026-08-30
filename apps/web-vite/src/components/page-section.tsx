/**
 * A reusable content section for standalone pages.
 *
 * One H2 plus the body it owns. The component enforces the hierarchy: the
 * title is always the same scale and weight, and the body sits immediately
 * beneath it with a tighter gap. Use it inside `SitePage` so the page-level
 * `gap-section` rhythm carries the sections.
 *
 * SOT: apps/web-vite/src/components/site-page.tsx · packages/theme/tokens.ts
 * SOT-KEYWORDS: page section heading content legal footer web-vite
 */
import { ReactNode } from 'react';
import { Heading } from '@acme/ui/typography';
import { View } from '@acme/ui/primitives';

interface PageSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function PageSection({ title, children }: PageSectionProps) {
  return (
    <View className="gap-group">
      <Heading
        level={2}
        className="font-moyo-text text-site-subtitle text-moyo-ink"
      >
        {title}
      </Heading>
      {children}
    </View>
  );
}
