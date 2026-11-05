'use client';
// GuardianFamilyHeader — the wards read, the child switcher it feeds, and the
// "Upload work for <child>" entry, as one block. Guardian home and the
// /homework route both mount it, so the three read states and the sign-in
// exit are written once.
//
// Three states for the read: a one-line skeleton while it lands; an honest
// failure with a retry (and a sign-in exit on 401) when it fails and there is
// no earlier list to show; the switcher otherwise. A zero-ward answer hides
// the switcher by its own `< 2` rule and the assign entry by its own
// no-child rule, and the timeline below says "No child linked yet".
// Mobbin: https://mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a (Acorns — You/Kid switcher pinned at the top of home re-scopes every section below) ·
//   https://mobbin.com/screens/ade862dc-3a68-429f-80be-595e4215442c (Kit — one "All kids" scope control above the list it scopes). Structure only.
// SOT: docs/work/pr-100/contract.md §Routes · docs/design/mobbin/homework-child-switcher.md · docs/design/mobbin/homework-assign-sheet.md
// SOT-KEYWORDS: guardian family header wards switcher upload entry read failure sign in

import { useRouter } from 'solito/navigation';
import { Button, LoadingSkeleton, ReadFailure } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import { ChildSwitcher } from '../family/child-switcher.tsx';
import type { ChildSummary } from '../family/family.store.ts';
import { GuardianAssignSheet } from './guardian-assign-sheet.tsx';
import { useGuardianWardsSync } from './use-guardian-wards.ts';

export interface GuardianFamilyHeaderProps {
  /** The active ward, read by the parent so the timeline below shares it. */
  child: ChildSummary | undefined;
}

export function GuardianFamilyHeader({ child }: GuardianFamilyHeaderProps) {
  const router = useRouter();
  const { loading, error, wards, retry } = useGuardianWardsSync();

  if (loading) return <LoadingSkeleton variant="line" count={1} />;

  if (error !== null && wards.length === 0) {
    const copy = readFailureCopy(
      error,
      'your children',
      'Nothing has changed. Your children are still linked to your account.',
    );
    return (
      <ReadFailure
        title={copy.title}
        description={copy.description}
        onRetry={retry}
        action={
          copy.signedOut ? (
            <Button title="Sign in" onPress={() => router.push('/login')} />
          ) : undefined
        }
      />
    );
  }

  return (
    <View className="gap-stack">
      <ChildSwitcher />
      <GuardianAssignSheet child={child} />
    </View>
  );
}
