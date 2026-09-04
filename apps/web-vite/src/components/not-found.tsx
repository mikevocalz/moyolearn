/**
 * The page for an address this site does not serve.
 *
 * It exists because there was no not-found component at all: an unmatched path
 * threw an unhandled `HTTPError` out of the server handler, so every wrong URL
 * on the marketing site answered `{"status":500,"unhandled":true}` — a raw JSON
 * body, no nav, no way back. `www.moyolearn.com/login` and `/signup` were the
 * two anyone actually hit, because the nav pointed there until `30e4a7c` moved
 * the front door to app.moyolearn.com.
 *
 * A 500 tells a reader the site is broken. A 404 tells them the address is
 * wrong. Only one of those is true here, and only one of them is worth acting
 * on — hence the list: a dead end that names every live door is a dead end
 * somebody can leave. `SitePage` supplies the nav, the footer and the `Back to
 * home` link, so this file only owns the copy.
 *
 * SOT: apps/web-vite/src/components/site-page.tsx · apps/web-vite/src/app-links.ts
 *      docs/site/copy-deck.md §1 (the nav's four product pages, in deck order)
 * SOT-KEYWORDS: not found 404 unmatched route dead end exits marketing web-vite
 */
import { Link, List, ListItem, Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { APP_LOGIN, APP_START } from '@/app-links';

/**
 * Every live destination, in the nav's order, with the two front doors last.
 * Kept here rather than imported from `site-nav`: the nav's list is private to
 * it, and a reader who mistyped an address needs the app doors too — which the
 * bar shows as buttons, not as links.
 */
const EXITS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-parents', label: 'For parents' },
  { href: '/for-schools', label: 'For schools' },
  { href: '/pricing', label: 'Pricing' },
  { href: APP_START, label: 'Start learning' },
  { href: APP_LOGIN, label: 'Log in' },
] as const;

export function NotFound() {
  return (
    <SitePage
      heading="That page isn’t here."
      lead="The address may have a typo, or the link that brought you here may be out of date. Everything the site does have is below."
    >
      <PageSection title="Where to go instead">
        <List className="gap-stack">
          {EXITS.map((exit) => (
            <ListItem key={exit.href}>
              <Link href={exit.href} className="text-site-body text-moyo-primary underline">
                {exit.label}
              </Link>
            </ListItem>
          ))}
        </List>
        <Paragraph className="text-site-body text-moyo-ink">
          If you followed a link from somewhere on this site, tell us at{' '}
          <Link href="mailto:info@moyolearn.com" className="text-moyo-primary underline">
            info@moyolearn.com
          </Link>{' '}
          and we’ll fix it.
        </Paragraph>
      </PageSection>
    </SitePage>
  );
}
