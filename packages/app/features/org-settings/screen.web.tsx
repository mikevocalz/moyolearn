'use client';
import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import type { OrgSettingsRead } from './org-settings.service';
import { OrgSettingsContent } from './org-settings-content';

export function OrgSettingsScreen({ read }: { read: OrgSettingsRead }) {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <OrgSettingsContent read={read} />
      </Container>
    </Main>
  );
}
