'use client';
// Public site header — tenant-branded through the shared ThemeProvider.
// Nav, profile, and mobile menu are identical to the marketing surface; only
// the colour resolution moves to the layout boundary.
// SOT: apps/web/app/(site)/layout.tsx · packages/app/providers/theme.tsx
// SOT-KEYWORDS: site header web marketing tenant brand theme provider


import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import type { OrgBranding } from '@acme/app';
import { useAppSession, useProfile } from '@acme/app';
import { useResolvedBrand } from '@acme/app';
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
      className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        active
          ? 'bg-action-primary font-semibold text-on-action'
          : 'text-on-header hover:bg-surface-raised hover:text-on-header'
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
  const brand = useResolvedBrand();
  const background = `bg-${brand.header}`;

  return (
    <Header className={`sticky top-0 z-50 border-b-2 border-border ${background}`}>
      <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" onClick={close} aria-label="Home" className="h-9 w-34 rounded-lg">
          <MoyoLearnLogo accessibilityLabel={orgBranding?.name ?? 'Moyo Learn'} />
        </Link>

        <Nav aria-label="Primary" className="relative hidden flex-1 justify-center gap-1 md:flex">
          {MARKETING_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </Nav>

        <View className="hidden flex-row items-center gap-stack md:flex">
          <Link
            href={PROFILE.href}
            aria-label="Your profile and settings"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 hover:ring-2 hover:ring-border-strong"
          >
            <Avatar name={name} imageUri={AVATAR_URI} size="md" />
          </Link>
        </View>

        <Pressable
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onPress={toggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border-2 border-border transition-colors duration-fast hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 active:opacity-80 md:hidden"
        >
          {open ? (
            <X className="h-5 w-5 text-on-header" />
          ) : (
            <Menu className="h-5 w-5 text-on-header" />
          )}
        </Pressable>
      </View>

      {open ? (
        <View className="border-t-2 border-border bg-surface-raised px-3 pb-4 md:hidden">
          <View className="my-2 h-px bg-border/60" />
          <Nav aria-label="Primary" id="mobile-menu" className="gap-1">
            {MARKETING_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
          </Nav>
        </View>
      ) : null}
    </Header>
  );
}
