'use client';
// Web-first surface (org.settings contract: no mobile tab); the fork exists so
// the barrel resolves on both bundlers, per the screen-fork pattern.
import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import type { OrgSettingsRead } from './org-settings.service';
import { OrgSettingsContent } from './org-settings-content';

export function OrgSettingsScreen({ read }: { read: OrgSettingsRead }) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <OrgSettingsContent read={read} />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
