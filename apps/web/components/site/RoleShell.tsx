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
  resolveTenantTheme,
  tenantCssVariables,
} from '@acme/app';
import type { ActiveContextKind, Membership, AppUser, OrgBranding } from '@acme/app';
import { isBillingRole } from '@acme/auth';
import { DashboardShell, LoadingSkeleton, Menu, MoyoLearnLogo, RoleScope, TenantScope } from '@acme/ui';
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
  Contact,
  LayoutGrid,
  GraduationCap,
  CircleDot,
  Settings,
  Shield,
  Star,
  Menu as MenuIcon,
} from '@acme/ui/icons';
import { HOT_NAV_BY_ROLE, HOT_NAV_LEARNER_BY_BAND, RAIL_BY_ROLE, PROFILE, useMobileMenu } from './nav';
import type { HotNavKind, NavItem as NavItemSpec, NavGroup as NavGroupSpec } from './nav';

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

function hotFor(kind: ActiveContextKind): kind is HotNavKind {
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
    // Star matches the mobile K–2 stuff tab's icon — one glyph per surface.
    case 'My Stuff':
      return <Star className={className} />;
    case 'Progress':
      return <TrendingUp className={className} />;
    case 'Reports':
      return <LineChart className={className} />;
    case 'Alerts':
    case 'Inbox':
      return <Bell className={className} />;
    case 'Family':
    case 'Families':
    case 'Learners':
    case 'My learners':
    case 'Clients':
    case 'People':
    case 'Educators':
      return <Users className={className} />;
    // Contact matches the retired ops sidebar's Leads glyph — one glyph per
    // surface, carried across the chrome move.
    case 'Leads':
      return <Contact className={className} />;
    case 'Notes':
    case 'Session notes':
      return <FileText className={className} />;
    case 'Schedule':
    case 'Calendar':
      return <Calendar className={className} />;
    case 'Settings':
    case 'Org settings':
      return <Settings className={className} />;
    // Shield matches the mobile org Safety tab's glyph — one glyph per surface.
    case 'Incident queue':
      return <Shield className={className} />;
    case 'Overview':
    case 'Outcomes':
      return <LayoutGrid className={className} />;
    case 'Academics':
    case 'Schools':
    case 'Enrollment':
      return <GraduationCap className={className} />;
    default:
      return <CircleDot className={className} />;
  }
}

// Roles whose Cool shell renders the ScopeSwitcher in the utility bar's start
// slot (mirrors scope-switcher.tsx's INSTITUTIONAL_ROLES — its own comment
// says tutors/teachers "use the avatar menu for any other hats").
const SCOPE_SWITCHER_KINDS: readonly ActiveContextKind[] = [
  'owner',
  'staff',
  'school_admin',
  'district_admin',
];

function MembershipMenu({ user }: { user: AppUser | null }) {
  const { activeContext, memberships } = useAppSession();
  const setContext = useSetContext();
  const router = useRouter();
  const name = useProfileName();

  const actions: MenuAction[] = useMemo(() => {
    const out: MenuAction[] = [{ id: 'profile', title: 'Profile & settings' }];
    // G §4 no-duplication law: an item lives in the rail or utility bar's start
    // slot XOR the avatar menu. In institutional shells the ScopeSwitcher owns
    // org/role switching, so the avatar menu keeps only account actions plus
    // the non-institutional hats the switcher deliberately excludes (e.g. the
    // owner-who-is-also-a-guardian). Elsewhere (hot shells, tutor/teacher) no
    // ScopeSwitcher renders and the avatar menu remains the switcher.
    const scopeSwitcherOwns = SCOPE_SWITCHER_KINDS.includes(activeContext.kind);
    const switchable = scopeSwitcherOwns
      ? memberships.filter((m) => !SCOPE_SWITCHER_KINDS.includes(m.role))
      : memberships;
    if (memberships.length > 1) {
      for (const m of switchable) {
        out.push({ id: m.id, title: labelForMembership(m) });
      }
    }
    return out;
  }, [memberships, activeContext.kind]);

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
      className={`flex items-center gap-2 rounded-control px-5 py-1.5 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring/50 ${
        active
          ? 'bg-tenant-header text-tenant-header-foreground shadow-sm'
          : 'text-tenant-header-muted hover:bg-tenant-surface-subtle hover:text-tenant-header-foreground'
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
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring/50 ${
        active
          ? 'bg-tenant-primary font-semibold text-tenant-primary-foreground'
          : 'text-tenant-header-muted hover:bg-tenant-surface-subtle hover:text-tenant-header-foreground'
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
  navItems: NavItemSpec[];
}) {
  const pathname = usePathname() ?? '/';
  const { open, toggle, close } = useMobileMenu();
  const { user } = useAppSession();
  const name = useProfileName();
  const profileActive = isActive(pathname, PROFILE.href);

  return (
    <View className="flex min-h-dvh flex-col bg-tenant-surface">
      <Header className="sticky top-0 z-50 border-b border-tenant-header-border bg-tenant-header px-4 py-3 sm:px-6">
        <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4">
          <Link
            href="/"
            onClick={close}
            aria-label="Home"
            className="h-9 w-34 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
          >
            <MoyoLearnLogo accessibilityLabel="Moyo Learn" />
          </Link>

          {/* The pill group hugs its tabs (w-fit + the row's justify-between
              centering it) instead of stretching flex-1 across the whole
              max-w-screen-2xl header — a three-tab learner nav in a
              viewport-wide pill read as a broken layout. */}
          <Nav aria-label="Primary" className="relative mx-auto hidden w-fit flex-row items-center gap-1 rounded-control border border-tenant-header-border bg-tenant-surface-subtle px-2 py-1 md:flex">
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-tenant-surface-subtle transition-colors duration-fast hover:bg-tenant-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring active:opacity-80 md:hidden"
          >
            <MenuIcon className="h-5 w-5 text-tenant-header-foreground" />
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
          <View className="absolute inset-x-0 top-[70px] z-50 rounded-b-sheet border-b-2 border-tenant-border bg-tenant-surface shadow-raised md:hidden">
            <Link
              href={PROFILE.href}
              onClick={close}
              aria-current={profileActive ? 'page' : undefined}
              className={`mx-3 mt-3 flex items-center gap-stack rounded-xl px-3 py-3 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring ${
                profileActive ? 'bg-tenant-surface-subtle' : 'hover:bg-tenant-surface-subtle'
              }`}
            >
              <Avatar name={name} imageUri={AVATAR_URI} size="lg" />
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-tenant-header-foreground">{name}</TWText>
                <TWText className="text-sm text-tenant-header-muted">Profile & settings</TWText>
              </View>
              <TWText className="text-lg text-tenant-header-muted">›</TWText>
            </Link>

            <View className="mx-6 my-2 h-px bg-tenant-border/60" />

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

            <View className="mx-6 my-2 h-px bg-tenant-border/60" />
            <ContextSwitcher />
            <RoleSwitcher />
          </View>
        </>
      ) : null}

      <Main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</Main>

      <Nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-row border-t-2 border-tenant-border bg-tenant-surface px-2 py-1 md:hidden"
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
      <View className="h-8 w-8 items-center justify-center rounded-md bg-tenant-surface-subtle">
        <TWText className="text-sm font-bold text-tenant-sidebar-foreground">
          {orgBranding.name[0]?.toUpperCase() ?? 'M'}
        </TWText>
      </View>
      <TWText className="truncate text-base font-semibold text-tenant-sidebar-foreground">{orgBranding.name}</TWText>
    </View>
  );
}

function BrandMark({ orgBranding }: { orgBranding?: OrgBranding | null }) {
  if (!orgBranding) {
    return (
      <View className="h-8 w-8 overflow-hidden rounded-md">
        {/* Width-sized: the logo attribute-sizes itself now, and the old
            fill-the-parent behavior here meant "as wide as the 32px box". */}
        <MoyoLearnLogo width={32} accessibilityLabel="Moyo" />
      </View>
    );
  }
  if (orgBranding.logoUrl) {
    return <Image src={orgBranding.logoUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" unoptimized />;
  }
  return (
    <View className="h-8 w-8 items-center justify-center rounded-md bg-tenant-surface-subtle">
      <TWText className="text-sm font-bold text-tenant-sidebar-foreground">
        {orgBranding.name[0]?.toUpperCase() ?? 'M'}
      </TWText>
    </View>
  );
}

function CoolShell({
  children,
  railGroups,
  orgBranding,
}: {
  children: ReactNode;
  railGroups: NavGroupSpec[];
  orgBranding?: OrgBranding | null;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { user } = useAppSession();
  const [mode, setMode] = useState<'auto' | 'rail' | 'menu'>('auto');
  const [menuOpen, setMenuOpen] = useState(false);

  // nav.ts owns the grouped shape (doc 36 §3 sets); this maps data → handlers
  // and passes it straight to DashboardShell's NavGroup API. Active matching
  // stays caller-side (J §6 item 4).
  const groups: NavGroup[] = useMemo(
    () =>
      railGroups.map((group) => ({
        title: group.title,
        items: group.items.map((item) => ({
          id: item.href,
          label: item.label,
          railLabel: item.railLabel,
          icon: iconFor(item.label, 'h-4 w-4'),
          active: isActive(pathname, item.href),
          onPress: () => router.push(item.href),
        })),
      })),
    [railGroups, pathname, router],
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

  const kind = activeContext.kind;
  /*
    The nav.ts `billingOnly` gate, applied against the live session: the owner
    kind always passes (an owner IS a billing role by the role mapping), and a
    staff hat passes only when its membership's organizationRole is one
    `isBillingRole` admits (finance). Mock personas carry no organizationRole,
    which is why the owner kind short-circuits rather than reading the field —
    hiding Settings from every dev owner would develop the surface unseen.
    Courtesy only: the page behind the item holds the server wall.
  */
  const activeMembership = memberships.find((m) => m.orgId === activeContext.orgId);
  const mayBill = kind === 'owner' || isBillingRole(activeMembership?.organizationRole);
  // Memoised (and above the guard returns — hooks are unconditional) so
  // CoolShell's own group memo keeps a stable array between renders.
  const railGroups = useMemo(
    () => (hotFor(kind) ? [] : RAIL_BY_ROLE[kind].filter((group) => !group.billingOnly || mayBill)),
    [kind, mayBill],
  );

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

  const accent = accentFor(kind);
  const tenantBrand = orgBranding ?? { name: 'Moyo' };
  const tenantTheme = resolveTenantTheme(tenantBrand, accent);
  const tenantVars = tenantCssVariables(tenantTheme);

  const shell = hotFor(kind) ? (
    <HotShell
      navItems={
        kind === 'learner'
          ? // Band fallback mirrors the mobile tab layout: no band reads as teen.
            HOT_NAV_LEARNER_BY_BAND[activeContext.gradeBand ?? 'teen']
          : HOT_NAV_BY_ROLE.guardian
      }
    >
      {children}
    </HotShell>
  ) : (
    <CoolShell railGroups={railGroups} orgBranding={orgBranding}>
      {children}
    </CoolShell>
  );

  return (
    <TenantScope variables={tenantVars} className="flex min-h-dvh flex-1">
      <RoleScope role={accent}>{shell}</RoleScope>
    </TenantScope>
  );
}
