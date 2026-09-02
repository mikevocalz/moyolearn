'use client';
// Public site header — tenant-branded through the TenantScope that wraps it.
// Nav, profile, and mobile menu are identical to the marketing surface; only
// the colour tokens move to the tenant theme variables.
// SOT: apps/web/components/site/SiteChrome.tsx · packages/app/core/tenant-theme.ts
// SOT-KEYWORDS: site header web marketing tenant brand theme

import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import type { OrgBranding } from '@acme/app';
import { useAppSession, useProfile } from '@acme/app';
import { MoyoLearnLogo } from '@acme/ui/brand';
import { Avatar } from '@acme/ui';
import { Header, Nav, View, Pressable } from '@acme/ui/tw';
import { Menu, X } from '@acme/ui/icons';
import { AVATAR_URI } from '@acme/app';
import { MARKETING_ITEMS, PROFILE, useMobileMenu } from './nav';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring/50 ${
        active
          ? 'bg-tenant-header text-tenant-header-foreground shadow-sm'
          : 'text-tenant-header-muted hover:bg-tenant-surface-subtle hover:text-tenant-header-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

export interface SiteHeaderProps {
  orgBranding?: OrgBranding | null;
}

export function SiteHeader({ orgBranding }: SiteHeaderProps) {
  const pathname = usePathname() ?? '/';
  const { user } = useAppSession();
  const name = useProfile((s) => s.name);
  const { open, toggle, close } = useMobileMenu();

  return (
    <Header className="sticky top-0 z-50 border-b-2 border-tenant-header-border bg-tenant-header text-tenant-header-foreground">
      <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* `w-fit`, not a fixed width: the logo attribute-sizes itself from its
            own aspect ratio, so any width pinned here is a number that has to be
            re-derived every time the mark changes — and the 136px it used to be
            was the OLD ratio, leaving 36px of dead click target past the mark. */}
        <Link href="/" onClick={close} aria-label="Home" className="h-9 w-fit rounded-lg">
          <MoyoLearnLogo accessibilityLabel={orgBranding?.name ?? 'Moyo Learn'} />
        </Link>

        <Nav aria-label="Primary" className="relative hidden flex-1 flex-row items-center justify-center gap-1 rounded-full border border-tenant-header-border bg-tenant-surface-subtle p-1 md:flex">
          {MARKETING_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </Nav>

        <View className="hidden flex-row items-center gap-stack md:flex">
          <Link
            href={PROFILE.href}
            aria-label="Your profile and settings"
            className="rounded-md p-1 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring/50 hover:bg-tenant-surface-subtle hover:ring-2 hover:ring-tenant-header-border"
          >
            <Avatar name={name} imageUri={AVATAR_URI} size="md" />
          </Link>
        </View>

        <Pressable
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onPress={toggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-tenant-surface-subtle transition-colors duration-fast hover:bg-tenant-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring/50 active:opacity-80 md:hidden"
        >
          {open ? (
            <X className="h-5 w-5 text-tenant-header-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-tenant-header-foreground" />
          )}
        </Pressable>
      </View>

      {open ? (
        <View className="border-t-2 border-tenant-border bg-tenant-surface p-4 md:hidden">
          <Nav aria-label="Primary" id="mobile-menu" className="gap-2">
            {MARKETING_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
          </Nav>
        </View>
      ) : null}
    </Header>
  );
}
