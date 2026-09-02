'use client';
import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { SettingsContent } from './settings-content';

export function SettingsScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        {/* Web only: /settings/org exists in the (business) group. The native
            fork passes no href — mobile has no org-settings route yet, so the
            Manage-plan row stays absent there rather than opening a 404. */}
        <SettingsContent managePlanHref="/settings/org" />
      </Container>
    </Main>
  );
}
