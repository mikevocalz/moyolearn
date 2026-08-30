/**
 * A shared shell for the marketing site\'s standalone content pages.
 *
 * Every footer/legal page gets the same sticky nav, main landmark, content
 * width, and footer so the route file only has to decide the heading, the
 * lead, and the sections. The shell is deliberately minimal — these pages are
 * read, not scrolled through — and uses the same tokens and type scale as the
 * chapters.
 *
 * SOT: apps/web-vite/src/components/site-nav.tsx · apps/web-vite/src/components/site-footer.tsx
 *      packages/theme/tokens.ts · docs/site/copy-deck.md
 * SOT-KEYWORDS: site page shell content page legal footer nav landmark
 */
import { ReactNode } from 'react';
import { Container, Heading } from '@acme/ui/typography';
import { Link, Main, Paragraph, Section, View } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

interface SitePageProps {
  readonly heading: string;
  readonly lead?: string;
  readonly children: ReactNode;
}

export function SitePage({ heading, lead, children }: SitePageProps) {
  return (
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <Section className="pt-section">
          <Container width="detail" className="gap-section">
            <View className="gap-group pb-40">
              <Heading
                level={1}
                size="display-xl"
                className="font-moyo-display text-site-chapter md:text-site-chapter"
              >
                {heading}
              </Heading>
              {lead ? (
                <Paragraph className="text-site-lead text-moyo-ink">
                  {lead}
                </Paragraph>
              ) : null}
            </View>

            {children}

            <Link href="/" className="text-site-body text-moyo-primary underline">
              Back to home
            </Link>
          </Container>
        </Section>
      </Main>
      <SiteFooter />
    </>
  );
}
