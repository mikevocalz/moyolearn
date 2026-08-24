import { useLocalSearchParams } from 'expo-router';
import { OnboardingFlowScreen } from '@acme/app';

export default function OnboardingFlowRoute() {
  const { flow } = useLocalSearchParams<{ flow: string }>();
  return <OnboardingFlowScreen flow={flow ?? ''} />;
}
