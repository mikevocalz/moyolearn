'use client';
import { useRouter } from 'solito/navigation';
import { ErrorScreen as Shared, type ErrorScreenProps } from './screen.shared';

/** Navigation is the fork's whole job; everything visual lives in the shared file. */
export function ErrorScreen(props: Omit<ErrorScreenProps, 'onGoHome' | 'onGoBack'>) {
  const router = useRouter();
  return (
    <Shared {...props} onGoHome={() => router.push('/')} onGoBack={() => router.back()} />
  );
}
