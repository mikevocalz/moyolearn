'use client';
import { Link } from 'solito/link';
import { useResolvedBrand } from '@acme/app';
import { MoyoLearnLogo } from '@acme/ui/brand';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { MARKETING_ITEMS, PROFILE } from './nav';

// The footer is a system map of the consumer site, not a dumping ground for
// admin tools or internal stack badges. Keep the Toolkit/Stack columns off
// public pages; they belong in internal docs or dev-only shells.
// SOT: packages/app/providers/theme.tsx
// SOT-KEYWORDS: site footer consumer public nav tenant brand theme

const footerLink =
  'text-sm text-on-footer/80 transition-colors duration-fast hover:text-on-footer ' +
  'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50';

export function SiteFooter() {
  const brand = useResolvedBrand();
  return (
    <Footer className={`border-t-2 border-border bg-${brand.footer}`}>
      <View className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        {/* Brand */}
        <View className="max-w-xs gap-stack">
          <View className="h-9 w-[136px]">
            <MoyoLearnLogo accessibilityLabel="Moyo Learn" />
          </View>
          <P className="text-sm leading-relaxed text-on-footer/80">
            AI tutoring that helps a child learn it by heart — and helps the
            parents, tutors, and teachers around them help better.
          </P>
        </View>

        {/* Pages */}
        <Nav aria-label="Pages" className="min-w-28 gap-2.5">
          <TWText className="text-xs font-semibold uppercase tracking-wider text-on-footer/70">
            Pages
          </TWText>
          {[...MARKETING_ITEMS, PROFILE].map((item) => (
            <Link key={item.href} href={item.href} className={footerLink}>
              {item.label}
            </Link>
          ))}
        </Nav>
      </View>

      {/* Legal bar */}
      <View className="border-t-2 border-border">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-element px-4 py-5 sm:px-6">
          <TWText className="text-xs text-on-footer/70">© Moyo</TWText>
          <TWText className="text-xs text-on-footer/70">Learn it by heart.</TWText>
        </View>
      </View>
    </Footer>
  );
}
