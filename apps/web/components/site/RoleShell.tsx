'use client';
// RoleShell — isolated, responsive chrome for one active role.
// Hot shells (learner, guardian) get a top nav on desktop and a compact bottom
// nav on mobile. Cool shells (tutor, teacher, school, district, business) get a
// responsive rail/sidebar/drawer via `DashboardShell`. A guarded layout can pass
// `allowedKinds` to force a context switch or redirect when the active role does
// not match the canonical route.
// SOT: apps/web/components/site/nav.ts · packages/app/providers/session/shell.ts
// SOT-KEYWORDS: role shell sidebar rail nav guard switcher hot cool

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'solito/navigation';
import { Link } from 'solito/link';
import type { AccentRole } from '@acme/theme';
import {
  useAppSession,
  useSetContext,
  useProfile,
  availableRoles,
  AVATAR_URI,
  ContextSwitcher,
  RoleSwitcher,
  ScopeSwitcher,
  ThemeProvider,
  resolveTenantTheme,
} from '@acme/app';
import type { ActiveContextKind, Membership, AppUser, OrgBranding } from '@acme/app';
import { DashboardShell, LoadingSkeleton, Menu, MoyoLearnLogo, RoleScope } from '@acme/ui';
import type { MenuAction, NavGroup } from '@acme/ui';
import { Header, Main, Nav, Pressable, View, Text as TWText } from '@acme/ui/tw';
import { Avatar } from '@acme/ui';
import {
  Home,
  Compass,
  Camera,
  TrendingUp,
  LineChart,
  Bell,
  Users,
  FileText,
  Calendar,
  LayoutGrid,
  GraduationCap,
  CircleDot,
  Menu as MenuIcon,
} from '@acme/ui/icons';
import { NAV_BY_ROLE, PROFILE, useMobileMenu } from './nav';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

function roleNoun(role: Membership['role']) {
  switch (role) {
    case 'tutor':
      return 'Tutor';
    case 'teacher':
      return 'Teacher';
    case 'owner':
      return 'Owner';
    case 'staff':
      return 'Staff';
    case 'school_admin':
      return 'School admin';
    case 'district_admin':
      return 'District admin';
    case 'guardian':
      return 'Parent';
    default:
      return 'Learner';
  }
}

function labelForMembership(m: Membership) {
  if (m.role === 'guardian') return m.orgName;
  return `${m.orgName} · ${roleNoun(m.role)}`;
}

function accentFor(kind: ActiveContextKind): AccentRole {
  switch (kind) {
    case 'learner':
      return 'learner';
    case 'guardian':
      return 'guardian';
    case 'tutor':
      return 'tutor';
    case 'teacher':
      return 'teacher';
    case 'owner':
    case 'staff':
      return 'org';
    case 'school_admin':
      return 'school';
    case 'district_admin':
      return 'district';
    default:
      return 'learner';
  }
}

function hotFor(kind: ActiveContextKind): boolean {
  return kind === 'learner' || kind === 'guardian';
}

function iconFor(label: string, className: string): ReactNode {
  switch (label) {
    case 'Today':
    case 'Home':
      return <Home className={className} />;
    case 'Subjects':
      return <Compass className={className} />;
    case 'Snap':
      return <Camera className={className} />;
    case 'Progress':
      return <TrendingUp className={className} />;
    case 'Reports':
      return <LineChart className={className} />;
    case 'Alerts':
    case 'Inbox':
      return <Bell className={className} />;
    case 'Family':
    case 'Learners':
    case 'Clients':
    case 'People':
      return <Users className={className} />;
    case 'Notes':
      return <FileText className={className} />;
    case 'Schedule':
      return <Calendar className={className} />;
    case 'Overview':
    case 'Outcomes':
      return <LayoutGrid className={className} />;
    case 'Academics':
    case 'Schools':
      return <GraduationCap className={className} />;
    default:
      return <CircleDot className={className} />;
  }
}

function MembershipMenu({ user }: { user: AppUser | null }) {
  const { activeContext, memberships } = useAppSession();
  const setContext = useSetContext();
  const router = useRouter();
  const name = useProfileName();

  const actions: MenuAction[] = useMemo(() => {
    const out: MenuAction[] = [{ id: 'profile', title: 'Profile & settings' }];
    if (memberships.length > 1) {
      for (const m of memberships) {
        out.push({ id: m.id, title: labelForMembership(m) });
      }
    }
    return out;
  }, [memberships]);

  if (!user) {
    return (
      <Link
        href={PROFILE.href}
        aria-label="Your profile and settings"
        className="rounded-full transition-shadow duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 hover:ring-2 hover:ring-border-strong"
      >
        <Avatar name={name} imageUri={AVATAR_URI} size="md" />
      </Link>
    );
  }

  return (
    <Menu
      actions={actions}
      onAction={(id) => {
        if (id === 'profile') {
          router.push(PROFILE.href);
          return;
        }
        const m = memberships.find((x) => x.id === id);
        if (m) {
          setContext({
            ...activeContext,
            kind: m.role,
            orgId: m.orgId,
            learnerId: m.role === 'learner' ? activeContext.learnerId ?? user.id : undefined,
            gradeBand: m.role === 'learner' ? activeContext.gradeBand : undefined,
          });
          // Dispatcher home so the new role's own shell renders the right content.
          router.push('/');
        }
      }}
    >
      <View className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 hover:ring-2 hover:ring-border-strong">
        <Avatar name={name} imageUri={AVATAR_URI} size="md" />
      </View>
    </Menu>
  );
}

function useProfileName() {
  // Profile store carries the display name for the avatar; fall back to the
  // session user name when the store has not been primed yet.
  const { user } = useAppSession();
  const name = useProfile((s) => s.name);
  return name || user?.name || 'Guest';
}

function HotNavLink({
  href,
  label,
  active,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        active
          ? 'bg-primary font-semibold text-on-primary'
          : 'text-text-muted hover:bg-surface-sunken hover:text-text'
      } ${className ?? ''}`}
    >
      {iconFor(label, 'h-4 w-4')}
      {label}
    </Link>
  );
}

function BottomNavLink({
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
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
        active
          ? 'bg-primary font-semibold text-on-primary'
          : 'text-text-muted hover:bg-surface-sunken hover:text-text'
      }`}
    >
      {iconFor(label, 'h-6 w-6')}
      {label}
    </Link>
  );
}

function HotShell({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems: typeof NAV_BY_ROLE.learner;
}) {
  const pathname = usePathname() ?? '/';
  const { open, toggle, close } = useMobileMenu();
  const { user } = useAppSession();
  const name = useProfileName();
  const profileActive = isActive(pathname, PROFILE.href);

  return (
    <View className="flex min-h-dvh flex-col">
      <Header className="sticky top-0 z-50 border-b bg-surface px-4 py-3 sm:px-6">
        <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4">
          <Link
            href="/"
            onClick={close}
            aria-label="Home"
            className="h-9 w-34 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
          >
            <MoyoLearnLogo accessibilityLabel="Moyo Learn" />
          </Link>

          <Nav aria-label="Primary" className="relative hidden flex-1 justify-center gap-1 md:flex">
            {navItems.map((item) => (
              <HotNavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
          </Nav>

          <View className="hidden flex-row items-center gap-stack md:flex">
            <MembershipMenu user={user} />
          </View>

          <Pressable
            onPress={toggle}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border-2 border-border transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 active:opacity-80 md:hidden"
          >
            <MenuIcon className="h-5 w-5 text-text" />
          </Pressable>
        </View>
      </Header>

      {open ? (
        <>
          <Pressable
            onPress={close}
            aria-label="Close menu"
            className="fixed inset-x-0 top-0 z-40 h-screen cursor-default items-start justify-start bg-ink-950/50 backdrop-blur-[2px] md:hidden"
          />
          <View className="absolute inset-x-0 top-[70px] z-50 rounded-b-sheet border-b-2 border-border bg-surface shadow-raised md:hidden">
            <Link
              href={PROFILE.href}
              onClick={close}
              aria-current={profileActive ? 'page' : undefined}
              className={`mx-3 mt-3 flex items-center gap-stack rounded-xl px-3 py-3 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
                profileActive ? 'bg-surface-sunken' : 'hover:bg-surface-sunken'
              }`}
            >
              <Avatar name={name} imageUri={AVATAR_URI} size="lg" />
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-text">{name}</TWText>
                <TWText className="text-sm text-text-muted">Profile & settings</TWText>
              </View>
              <TWText className="text-lg text-text-muted">›</TWText>
            </Link>

            <View className="mx-6 my-2 h-px bg-border/60" />

            <Nav aria-label="Primary" id="mobile-menu" className="gap-1 px-3 pb-4">
              {navItems.map((item) => (
                <HotNavLink
                  key={item.href}
                  {...item}
                  active={isActive(pathname, item.href)}
                  className="py-3.5 text-base"
                />
              ))}
            </Nav>

            <View className="mx-6 my-2 h-px bg-border/60" />
            <ContextSwitcher />
            <RoleSwitcher />
          </View>
        </>
      ) : null}

      <Main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</Main>

      <Nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-row border-t-2 border-border bg-surface px-2 py-1 md:hidden"
      >
        {navItems.map((item) => (
          <BottomNavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </Nav>
    </View>
  );
}

function BrandLockup({ orgBranding }: { orgBranding?: OrgBranding | null }) {
  if (!orgBranding) {
    return (
      <View className="h-9 w-34">
        <MoyoLearnLogo accessibilityLabel="Moyo Learn" />
      </View>
    );
  }
  return (
    <View className="h-9 max-w-34 flex-row items-center gap-2 px-1">
      <View className="h-8 w-8 items-center justify-center rounded-md bg-surface-sunken">
        <TWText className="text-sm font-bold text-text">
          {orgBranding.name[0]?.toUpperCase() ?? 'M'}
        </TWText>
      </View>
      <TWText className="truncate text-base font-semibold text-text">{orgBranding.name}</TWText>
    </View>
  );
}

function BrandMark({ orgBranding }: { orgBranding?: OrgBranding | null }) {
  if (!orgBranding) {
    return (
      <View className="h-8 w-8 overflow-hidden rounded-md">
        <MoyoLearnLogo accessibilityLabel="Moyo" />
      </View>
    );
  }
  if (orgBranding.logoUrl) {
    return <Image src={orgBranding.logoUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" unoptimized />;
  }
  return (
    <View className="h-8 w-8 items-center justify-center rounded-md bg-surface-sunken">
      <TWText className="text-sm font-bold text-text">
        {orgBranding.name[0]?.toUpperCase() ?? 'M'}
      </TWText>
    </View>
  );
}

function CoolShell({
  children,
  navItems,
  orgBranding,
}: {
  children: ReactNode;
  navItems: typeof NAV_BY_ROLE.learner;
  orgBranding?: OrgBranding | null;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { user } = useAppSession();
  const [mode, setMode] = useState<'auto' | 'rail' | 'menu'>('auto');
  const [menuOpen, setMenuOpen] = useState(false);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        items: navItems.map((item) => ({
          id: item.href,
          label: item.label,
          icon: iconFor(item.label, 'h-4 w-4'),
          active: isActive(pathname, item.href),
          onPress: () => router.push(item.href),
        })),
      },
    ],
    [navItems, pathname, router],
  );

  return (
    <DashboardShell
      groups={groups}
      brand={<BrandLockup orgBranding={orgBranding} />}
      brandMark={<BrandMark orgBranding={orgBranding} />}
      mode={mode}
      onSetMode={setMode}
      menuOpen={menuOpen}
      onToggleMenu={() => setMenuOpen((o) => !o)}
      topBarStart={<ScopeSwitcher />}
      topBarEnd={<MembershipMenu user={user} />}
    >
      {children}
    </DashboardShell>
  );
}

export interface RoleShellProps {
  children: ReactNode;
  /** Restrict this shell to one or more roles. Mismatched authed users are
   * switched to a matching membership if they have one, or redirected to login.
   * Omit for the shared `(site)` chrome, which follows the active context. */
  allowedKinds?: readonly ActiveContextKind[];
  /** Tenant branding resolved from the request host, used for co-branding the
   * institutional cool shell and its theme. */
  orgBranding?: OrgBranding | null;
}

export function RoleShell({ children, allowedKinds, orgBranding }: RoleShellProps) {
  const { user, activeContext, memberships, status } = useAppSession();
  const setContext = useSetContext();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anon' && allowedKinds) {
      router.push('/login');
    }
  }, [status, allowedKinds, router]);

  useEffect(() => {
    if (status !== 'authed' || !allowedKinds) return;
    if (allowedKinds.includes(activeContext.kind)) return;

    const roles = availableRoles({ user, memberships });
    const match = roles.find((r) => allowedKinds.includes(r));
    if (match) {
      const membership = memberships.find((m) => m.role === match);
      setContext({
        ...activeContext,
        kind: match,
        orgId: membership?.orgId,
        learnerId: match === 'learner' ? activeContext.learnerId ?? user?.id : undefined,
        gradeBand: match === 'learner' ? activeContext.gradeBand : undefined,
      });
      router.push('/');
    } else {
      router.push('/login');
    }
  }, [allowedKinds, activeContext, memberships, status, user, setContext, router]);

  const misguarded = status === 'authed' && allowedKinds && !allowedKinds.includes(activeContext.kind);
  if (status === 'loading' || misguarded) {
    return (
      <View className="flex-1">
        <LoadingSkeleton count={6} className="m-inset" />
      </View>
    );
  }

  if (status === 'anon') {
    // Either the redirect above is in flight or this is the shared site chrome.
    // Returning the shell here keeps the layout stable while the guard resolves.
    return <View className="flex-1">{children}</View>;
  }

  const accent = accentFor(activeContext.kind);
  const navItems = NAV_BY_ROLE[activeContext.kind] ?? [];
  const shell = hotFor(activeContext.kind) ? (
    <HotShell navItems={navItems}>{children}</HotShell>
  ) : (
    <CoolShell navItems={navItems} orgBranding={orgBranding}>
      {children}
    </CoolShell>
  );
  const brand = resolveTenantTheme(orgBranding?.brandTheme, accent);

  return (
    <ThemeProvider value={brand}>
      <RoleScope role={accent}>{shell}</RoleScope>
    </ThemeProvider>
  );
}
