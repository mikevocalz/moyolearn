'use client';
import { ScrollView, View } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { ProfileContent } from './profile-content';

export function ProfileScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <ProfileContent />
        </Container>
      </ScrollView>
    </View>
  );
}
